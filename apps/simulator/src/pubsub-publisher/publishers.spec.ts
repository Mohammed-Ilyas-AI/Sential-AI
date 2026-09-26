import type { TransactionEvent } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import { DirectPushTransactionEventPublisher } from './direct-push-transaction-event.publisher.js';
import { PubSubTransactionEventPublisher, type OrderedTopic } from './pubsub-transaction-event.publisher.js';

const event: TransactionEvent = {
  schemaVersion: '1.0',
  tenantId: 'BANK_A',
  eventId: 'EVT-sim-0001-SETTLED',
  idempotencyKey: 'idem-sim-0001-SETTLED',
  accountSequence: 3,
  transactionId: 'TX-sim-0001',
  status: 'SETTLED',
  sourceAccountToken: 'acct_tok_1a2b3c4d',
  destinationInstitutionId: 'BANK_B',
  destinationAccountToken: 'acct_tok_5e6f7a8b',
  amount: 240_000,
  currency: 'SGD',
  channel: 'APP',
  type: 'TRANSFER',
  occurredAt: '2026-09-24T11:30:41.500Z',
};

describe('PubSubTransactionEventPublisher', () => {
  it('publishes JSON ordered by sourceAccountToken', async () => {
    const published: unknown[] = [];
    const topic: OrderedTopic = { publishMessage: async (message) => (published.push(message), 'id-1'), resumePublishing: () => undefined };
    await new PubSubTransactionEventPublisher(topic).publish(event);
    expect(published).toHaveLength(1);
    const message = published[0] as { data: Buffer; orderingKey: string; attributes: Record<string, string> };
    expect(message.orderingKey).toBe('acct_tok_1a2b3c4d');
    expect(JSON.parse(message.data.toString())).toEqual(event);
    expect(message.attributes).toEqual({ eventType: 'TransactionEvent', schemaVersion: '1.0', status: 'SETTLED' });
  });

  it('resumes the ordering key after a failed publish, then reports the failure', async () => {
    const resumed: string[] = [];
    const topic: OrderedTopic = {
      publishMessage: async () => Promise.reject(new Error('unavailable')),
      resumePublishing: (key) => resumed.push(key),
    };
    await expect(new PubSubTransactionEventPublisher(topic).publish(event)).rejects.toThrow('unavailable');
    expect(resumed).toEqual(['acct_tok_1a2b3c4d']);
  });
});

describe('DirectPushTransactionEventPublisher', () => {
  it('delivers the exact Pub/Sub push envelope to sentinel-core', async () => {
    const requests: { url: string; body: string }[] = [];
    const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), body: String(init?.body) });
      return new Response('{"outcome":"PROJECTED"}', { status: 200 });
    }) as typeof fetch;
    await new DirectPushTransactionEventPublisher('http://core/internal/pubsub/transaction-events', fakeFetch).publish(event);
    const envelope = JSON.parse(requests[0]?.body ?? '{}') as { message: { data: string; orderingKey: string; messageId: string } };
    expect(requests[0]?.url).toBe('http://core/internal/pubsub/transaction-events');
    expect(envelope.message.orderingKey).toBe(event.sourceAccountToken);
    expect(envelope.message.messageId).toBe(event.eventId);
    expect(JSON.parse(Buffer.from(envelope.message.data, 'base64').toString())).toEqual(event);
  });

  it('fails loudly when sentinel-core rejects the event', async () => {
    const fakeFetch = (async () => new Response('{"error":"invalid"}', { status: 400 })) as typeof fetch;
    await expect(new DirectPushTransactionEventPublisher('http://core/x', fakeFetch).publish(event)).rejects.toThrow('400');
  });
});
