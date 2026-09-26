import type { DesignatedBillingOrganisations, DrainExclusionReason, Transaction } from '@sentinel/domain';

export type DrainExclusionFor = (
  transaction: Transaction,
  billingOrganisations: DesignatedBillingOrganisations,
) => DrainExclusionReason | null;

/** Recurring standing instructions, recurring GIRO/eGIRO and bills to designated billing organisations bypass the safeguard. */
export const drainExclusionFor: DrainExclusionFor = (transaction, billingOrganisations) => {
  if (transaction.type === 'STANDING') return 'STANDING';
  if (transaction.type === 'GIRO') return 'GIRO';
  if (transaction.type === 'BILL' && billingOrganisations.isDesignated(transaction.payeeId)) return 'BILL_ORG';
  return null;
};
