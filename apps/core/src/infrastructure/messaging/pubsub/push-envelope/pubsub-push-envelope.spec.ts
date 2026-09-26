import { describe, expect, it } from 'vitest';
import { decodePushEnvelope } from './pubsub-push-envelope.js';

const encode = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64');

describe('decodePushEnvelope', () => {
  it('decodes base64 JSON data with its ordering key and attributes', () => {
    const result = decodePushEnvelope({
      message: {
        messageId: 'msg-1',
        orderingKey: 'tok-acc-demo-0001',
        attributes: { eventType: 'TransactionEvent' },
        data: encode({ status: 'SETTLED' }),
      },
      subscription: 'projects/example/subscriptions/example',
    });
    expect(result).toEqual({
      valid: true,
      message: {
        messageId: 'msg-1',
        orderingKey: 'tok-acc-demo-0001',
        attributes: { eventType: 'TransactionEvent' },
        data: { status: 'SETTLED' },
      },
    });
  });

  it('rejects a body without a message', () => {
    expect(decodePushEnvelope({})).toEqual({ valid: false, problem: 'missing message' });
  });

  it('rejects data that is not base64-encoded JSON', () => {
    const result = decodePushEnvelope({ message: { messageId: 'msg-2', data: 'not-json' } });
    expect(result).toEqual({ valid: false, problem: 'data is not base64-encoded JSON' });
  });
});
