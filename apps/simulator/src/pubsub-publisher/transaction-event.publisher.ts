import type { TransactionEvent } from '@sentinel/domain';

/** Publishes lifecycle events after the decision, ordered by sourceAccountToken. */
export interface TransactionEventPublisher {
  publish(event: TransactionEvent): Promise<void>;
}
