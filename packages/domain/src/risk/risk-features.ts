import type { EdgeLinkage } from '../graph/edge-evidence.js';
import type { MinorUnits } from '../money/minor-units.js';
import type { IsoTimestamp } from '../time/iso-timestamp.js';

/**
 * The deterministic features extracted for one evaluation. Every risk rule is a pure function of these plus
 * the transaction, the account and the drain state.
 */
export interface RiskFeatures {
  readonly evaluatedAt: IsoTimestamp;
  /** Hours since the device was first seen; null when the device is established or absent. */
  readonly deviceAgeHours: number | null;
  readonly deviceToken: string | null;
  /** Hours since the payee was added; null when the payee is established. */
  readonly payeeAgeHours: number | null;
  readonly payeeToken: string | null;
  readonly velocityRatio: number;
  readonly amountP95: MinorUnits;
  readonly coolingOffActive: boolean;
  /** One linkage per flagged entity within two hops of the destination. */
  readonly flaggedLinks: readonly EdgeLinkage[];
}
