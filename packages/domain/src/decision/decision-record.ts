import type { MinorUnits } from '../money/minor-units.js';
import type { RiskAssessment, RiskBand } from '../risk/risk-assessment.js';
import type { InstitutionId } from '../tenant/tenant-identifiers.js';
import type { IsoTimestamp } from '../time/iso-timestamp.js';
import type { DecisionResponse } from './decision-response.js';

/** A decision as stored in `decisions`: the primary source of the scored live tape. */
export interface DecisionRecord extends DecisionResponse {
  readonly accountId: string;
  /** Own-tenant display reference, when the bank reported one. */
  readonly accountReference?: string;
  readonly institutionId: InstitutionId;
  readonly destinationInstitutionId: InstitutionId;
  readonly amount: MinorUnits;
  readonly band: RiskBand;
  readonly occurredAt: IsoTimestamp;
  /** Snapshot of the assessment the decision cites; contributions[] are copied, never recomputed. */
  readonly assessment: RiskAssessment;
}
