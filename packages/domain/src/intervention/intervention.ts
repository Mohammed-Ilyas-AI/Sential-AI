import type { RiskAssessment } from '../risk/risk-assessment.js';
import type { IsoTimestamp } from '../time/iso-timestamp.js';

export type InterventionState = 'HELD' | 'RELEASED' | 'REJECTED' | 'CANCELLED';

/** EVALUATING precedes the first record; a cleared transaction never produces an intervention. */
export type InterventionPriorState = InterventionState | 'EVALUATING';

export type InterventionActor = 'SYSTEM' | 'ANALYST' | 'CUSTOMER';

/** Append-only audit record: a release inserts a record, it never mutates the hold. */
export interface Intervention {
  readonly id: string;
  readonly decisionId: string;
  readonly transactionId: string;
  readonly accountId: string;
  readonly previousState: InterventionPriorState;
  readonly state: InterventionState;
  readonly holdUntil?: IsoTimestamp;
  /** For a cascaded hold, the transaction whose threshold breach put the account into the hold state. */
  readonly cascadeOfTransactionId?: string;
  readonly reasonCodes: readonly string[];
  readonly actor: InterventionActor;
  /** Always recorded for ANALYST actions. */
  readonly actorIdentity?: string;
  readonly actedAt: IsoTimestamp;
  readonly policyVersion: string;
  readonly rulesetVersion: string;
  /** The assessment snapshot that justified this transition. */
  readonly assessment: RiskAssessment;
}
