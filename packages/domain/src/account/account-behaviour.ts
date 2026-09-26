import type { MinorUnits } from '../money/minor-units.js';
import type { IsoTimestamp } from '../time/iso-timestamp.js';

/**
 * Behavioural baselines the VELOCITY and BEHAVIOUR_DEV rules compare against. The HTML reference treats both
 * as explicit inputs (a per-transfer velocity ratio and a 95th-percentile amount); the bank connector reports
 * them with the account.
 */
export interface AccountBehaviour {
  /** Transactions per minute against the account's rolling baseline (1.0 = baseline). */
  readonly velocityRatio: number;
  /** 95th percentile of the account's 90-day transaction-amount distribution. */
  readonly amountP95: MinorUnits;
  readonly observedAt: IsoTimestamp;
}
