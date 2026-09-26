import type { MinorUnits } from '../money/minor-units.js';
import type { DrainState } from '../policy/drain-state.js';
import type { RiskFeatures } from './risk-features.js';

/** The 24-hour window, computed from the transactions projection (effectiveAmount only). Input to the drain gate. */
export interface RollingWindow {
  readonly accountId: string;
  readonly windowStart: string;
  readonly balance24hAgo: MinorUnits;
  /** Eligible outflow already in the window, excluding the transaction being evaluated. */
  readonly outflow24h: MinorUnits;
}

/** Input to the risk rules: the window, the drain state the gate produced, and the extracted features. */
export interface WindowContext extends RollingWindow {
  readonly drain: DrainState;
  readonly features: RiskFeatures;
}
