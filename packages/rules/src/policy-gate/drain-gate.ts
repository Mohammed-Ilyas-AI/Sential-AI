import type {
  DesignatedBillingOrganisations,
  DrainState,
  RapidDrainPolicy,
  RollingWindow,
  Transaction,
} from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';

export type DrainGate = (
  transaction: Transaction,
  window: RollingWindow,
  policy: RapidDrainPolicy,
  billingOrganisations: DesignatedBillingOrganisations,
) => DrainState;

/**
 * The published SG-RD-50 control, a separate code path from the score (T§4): exclusions first, then
 * protection at window start, then drainPct = (outflow24h + amount) / balance24hAgo, met when strictly
 * above the gate. Thresholds arrive as policy configuration, never as literals.
 */
export const drainGate: DrainGate = () => {
  throw new NotYetImplementedError('Rapid-drain gate', 'scheduled for build order step 7');
};
