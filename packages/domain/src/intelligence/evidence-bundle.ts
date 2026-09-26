import type { AccountProfile } from '../account/account-profile.js';
import type { AlertSummary } from '../alert/alert-summary.js';
import type { GraphNeighbourhood } from '../graph/graph-neighbourhood.js';
import type { Intervention } from '../intervention/intervention.js';
import type { DrainState } from '../policy/drain-state.js';
import type { RiskAssessment } from '../risk/risk-assessment.js';
import type { Transaction } from '../transaction/transaction.js';
import type { DeviceEvent, PayeeEvent } from './evidence-history.js';

/**
 * The one typed object Gemini receives: never a database dump, never a concatenated prompt.
 * Capped to bound cost, latency and the model's room to wander.
 */
export interface EvidenceBundle {
  readonly account: AccountProfile;
  /** Including contributions[]. */
  readonly assessment: RiskAssessment;
  readonly drain: DrainState;
  /** Last 50, capped. */
  readonly recentTransactions: readonly Transaction[];
  readonly deviceHistory: readonly DeviceEvent[];
  readonly payeeHistory: readonly PayeeEvent[];
  readonly priorAlerts: readonly AlertSummary[];
  readonly interventions: readonly Intervention[];
  /** Two hops, capped at 40 nodes. */
  readonly neighbourhood: GraphNeighbourhood;
}
