import type { TransactionEvent } from '@sentinel/domain';
import type { FetchFunction } from '../decision-api/core-http.client.js';
import { CoreApiError } from '../decision-api/core-http.client.js';
import { toPubSubMessage, type TransactionEventPublisher } from './transaction-event.publisher.js';

/**
 * Local development without a GCP project: delivers each event to sentinel-core in exactly the shape a Pub/Sub
 * push subscription would, in order. sentinel-core must run with push verification disabled for this.
 */
export class DirectPushTransactionEventPublisher implements TransactionEventPublisher {
  constructor(
    private readonly pushEndpoint: string,
    private readonly fetchFunction: FetchFunction = fetch,
  ) {}

  async publish(event: TransactionEvent): Promise<void> {
    const message = toPubSubMessage(event);
    const response = await this.fetchFunction(this.pushEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: {
          messageId: event.eventId,
          orderingKey: message.orderingKey,
          attributes: message.attributes,
          data: message.data.toString('base64'),
        },
        subscription: 'local/direct-push',
      }),
    });
    if (!response.ok) throw new CoreApiError(response.status, this.pushEndpoint, await response.text());
  }

  async close(): Promise<void> {
    return undefined;
  }
}
