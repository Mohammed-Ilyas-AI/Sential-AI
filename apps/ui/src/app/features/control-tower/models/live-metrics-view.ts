import type { MinorUnits } from '@sentinel/domain';

/** The four counters across the top of the Live Operations Command Center (M§5.1). */
export interface LiveMetricsView {
  readonly transactionsScored: number;
  readonly openAlerts: number;
  readonly transactionsOnHold: number;
  /** Sum of amounts currently held by the policy gate. */
  readonly valueOnHold: MinorUnits;
}
