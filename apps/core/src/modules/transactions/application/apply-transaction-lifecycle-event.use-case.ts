import type { TransactionEvent } from '@sentinel/domain';

export interface LifecycleProjectionOptions {
  /** Set by the decision path from the gate; lifecycle events keep whatever the first event recorded. */
  readonly drainExcluded?: boolean;
}

/** PROJECTED changed state; DUPLICATE was a retried idempotencyKey; HISTORY_ONLY arrived out of order. */
export type LifecycleOutcome = 'PROJECTED' | 'DUPLICATE' | 'HISTORY_ONLY';

/**
 * Appends the event, then updates the projection: PENDING, AUTHORISED and SETTLED count the amount once;
 * REVERSED and CANCELLED set it to zero; an older accountSequence updates history only. Never scores.
 */
export interface ApplyTransactionLifecycleEvent {
  apply(event: TransactionEvent, options?: LifecycleProjectionOptions): Promise<LifecycleOutcome>;
}
