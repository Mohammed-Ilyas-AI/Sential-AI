import type { RiskBand } from '../risk/risk-assessment.js';
import type { IsoTimestamp } from '../time/iso-timestamp.js';

/** A prior alert as the evidence bundle presents it. */
export interface AlertSummary {
  readonly alertId: string;
  readonly score: number;
  readonly band: RiskBand;
  readonly raisedAt: IsoTimestamp;
}
