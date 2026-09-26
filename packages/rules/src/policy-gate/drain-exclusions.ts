import type { DesignatedBillingOrganisations, DrainExclusionReason, Transaction } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';

export type DrainExclusionFor = (
  transaction: Transaction,
  billingOrganisations: DesignatedBillingOrganisations,
) => DrainExclusionReason | null;

/** Recurring standing instructions, recurring GIRO/eGIRO and bills to designated billing organisations bypass the safeguard. */
export const drainExclusionFor: DrainExclusionFor = () => {
  throw new NotYetImplementedError('Rapid-drain exclusions', 'scheduled for build order step 7');
};
