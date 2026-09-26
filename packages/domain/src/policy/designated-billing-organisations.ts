/** Bill payments to designated billing organisations are excluded from the rapid-drain safeguard. */
export interface DesignatedBillingOrganisations {
  isDesignated(payeeId: string): boolean;
}
