import type { Alert, DecisionRecord, RecordedRiskAssessment } from '@sentinel/domain';

/** LOW raises nothing; ELEVATED and HIGH are queued; CRITICAL is promoted. */
export interface RaiseAlert {
  raiseFor(decision: DecisionRecord, assessment: RecordedRiskAssessment): Promise<Alert | null>;
}
