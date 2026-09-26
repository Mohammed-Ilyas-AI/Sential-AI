import type { TransactionEvent } from '@sentinel/domain';

/** Publishes lifecycle events after the decision, ordered by sourceAccountToken. */
export interface TransactionEventPublisher {
  publish(event: TransactionEvent): Promise<void>;
  close(): Promise<void>;
}

/** The Pub/Sub message for a canonical event: JSON data, ordered per account token. */
export function toPubSubMessage(event: TransactionEvent): {
  readonly data: Buffer;
  readonly orderingKey: string;
  readonly attributes: Readonly<Record<string, string>>;
} {
  return {
    data: Buffer.from(JSON.stringify(event)),
    orderingKey: event.sourceAccountToken,
    attributes: { eventType: 'TransactionEvent', schemaVersion: event.schemaVersion, status: event.status },
  };
}
