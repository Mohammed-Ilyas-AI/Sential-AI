import type { MinorUnits } from '../money/minor-units.js';

export type DrainExclusionReason = 'STANDING' | 'GIRO' | 'BILL_ORG';

export interface DrainState {
  readonly balanceAtWindowStart: MinorUnits;
  readonly outflow24h: MinorUnits;
  readonly drainPct: number;
  /** Strictly greater than the gate percentage, matching the published wording. */
  readonly thresholdMet: boolean;
  readonly excluded: boolean;
  readonly exclusionReason?: DrainExclusionReason;
}
