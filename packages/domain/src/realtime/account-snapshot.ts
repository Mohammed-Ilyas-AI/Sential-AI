import type { Intervention } from '../intervention/intervention.js';
import type { DrainState } from '../policy/drain-state.js';
import type { RiskAssessment } from '../risk/risk-assessment.js';

/** Server truth sent on connect and reconnect; it resets any optimistic client-side drift. */
export interface AccountSnapshot {
  readonly accountId: string;
  readonly drain: DrainState;
  readonly latestAssessment?: RiskAssessment;
  readonly activeIntervention?: Intervention;
}
