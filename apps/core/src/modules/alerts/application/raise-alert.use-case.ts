import type { Alert, DecisionRecord } from '@sentinel/domain';

/** LOW raises nothing unless held; ELEVATED and HIGH are queued; CRITICAL is promoted. */
export interface RaiseAlert {
  raiseFor(decision: DecisionRecord): Promise<Alert | null>;
}
