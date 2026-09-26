import type { DesignatedBillingOrganisations, RapidDrainPolicy } from '@sentinel/domain';

/** The policy in force comes from configuration, never from constants in detection code. */
export interface PolicyConfiguration {
  rapidDrainPolicy(): RapidDrainPolicy;
  designatedBillingOrganisations(): DesignatedBillingOrganisations;
}
