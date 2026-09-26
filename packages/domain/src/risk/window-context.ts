import type { MinorUnits } from '../money/minor-units.js';
import type { DrainState } from '../policy/drain-state.js';

/** The 24-hour window, computed from the transactions projection (effectiveAmount only). Input to the drain gate. */
export interface RollingWindow {
  readonly accountId: string;
  readonly balance24hAgo: MinorUnits;
  /** Outflow already in the window, excluding the transaction being evaluated. */
  readonly outflow24h: MinorUnits;
}

/**
 * Input to the risk rules: the window plus the drain state the gate produced for this transaction.
 * Rule-specific inputs (velocity baseline, amount distribution, flagged links) are added with the
 * HTML behavioural reference.
 */
export interface WindowContext extends RollingWindow {
  readonly drain: DrainState;
}
