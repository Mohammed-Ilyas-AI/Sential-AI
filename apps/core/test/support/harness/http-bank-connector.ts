import type {
  AccountSecurityEvent,
  BankAccountReport,
  DecisionRequest,
  DecisionResponse,
  NetworkObservation,
  SecurityEventReceipt,
  TransactionEvent,
} from '@sentinel/domain';
import type { BankConnector } from '@sentinel/scenarios';
import type { TestClock } from './test-clock.js';

export class HttpCallError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`HTTP ${status}: ${JSON.stringify(body)}`);
  }
}

export async function callJson<TResponse>(baseUrl: string, method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<{ readonly status: number; readonly body: TResponse }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  const isJson = response.headers.get('content-type')?.includes('application/json') === true;
  return { status: response.status, body: (isJson && text ? JSON.parse(text) : text || null) as TResponse };
}

/** A Pub/Sub push request, exactly as the push subscription would deliver it. */
export function pushEnvelopeFor(event: TransactionEvent): unknown {
  return {
    message: {
      messageId: event.eventId,
      orderingKey: event.sourceAccountToken,
      attributes: { schemaVersion: event.schemaVersion },
      data: Buffer.from(JSON.stringify(event)).toString('base64'),
    },
    subscription: 'projects/sentinel-test/subscriptions/sentinel-core-transaction-events',
  };
}

/**
 * The bank's side over real HTTP. Before each call the test clock moves to the event's own time, so every
 * decidedAt and holdUntil is deterministic.
 */
export class HttpBankConnector implements BankConnector {
  constructor(
    private readonly baseUrl: string,
    private readonly clock: TestClock,
  ) {}

  async reportAccount(report: BankAccountReport): Promise<void> {
    await this.expectOk('PUT', `/v1/accounts/${report.accountToken}`, report);
  }

  async observeNetwork(observation: NetworkObservation): Promise<void> {
    await this.expectOk('POST', '/v1/network/observations', observation);
  }

  async recordSecurityEvent(event: AccountSecurityEvent): Promise<SecurityEventReceipt> {
    this.clock.set(event.occurredAt);
    return this.expectOk('POST', '/v1/events/security', event);
  }

  async requestDecision(request: DecisionRequest): Promise<DecisionResponse> {
    this.clock.set(request.occurredAt);
    return this.expectOk('POST', '/v1/decision/transactions', request);
  }

  async publishLifecycleEvent(event: TransactionEvent): Promise<void> {
    this.clock.set(event.occurredAt);
    await this.expectOk('POST', '/internal/pubsub/transaction-events', pushEnvelopeFor(event));
  }

  private async expectOk<TResponse>(method: string, path: string, body: unknown): Promise<TResponse> {
    const response = await callJson<TResponse>(this.baseUrl, method, path, body);
    if (response.status >= 300) throw new HttpCallError(response.status, response.body);
    return response.body;
  }
}
