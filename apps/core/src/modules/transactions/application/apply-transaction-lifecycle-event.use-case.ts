import type { TransactionEvent } from '@sentinel/domain';

/**
 * Appends the event, then updates the projection: PENDING, AUTHORISED and SETTLED count the amount once;
 * REVERSED and CANCELLED set it to zero; an older accountSequence updates history only. Never scores.
 */
export interface ApplyTransactionLifecycleEvent {
  apply(event: TransactionEvent): Promise<void>;
}
