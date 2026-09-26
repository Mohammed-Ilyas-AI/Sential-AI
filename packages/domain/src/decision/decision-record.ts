import type { MinorUnits } from '../money/minor-units.js';
import type { RiskBand } from '../risk/risk-assessment.js';
import type { DecisionResponse } from './decision-response.js';

/** A decision as stored in `decisions`: the primary source of the scored live tape. */
export interface DecisionRecord extends DecisionResponse {
  readonly accountId: string;
  readonly amount: MinorUnits;
  readonly band: RiskBand;
}
