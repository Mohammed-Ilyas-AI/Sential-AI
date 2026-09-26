import type { DesignatedBillingOrganisations, RapidDrainPolicy } from '@sentinel/domain';

/** The policy in force comes from configuration, never from constants in detection code. */
export interface PolicyConfiguration {
  rapidDrainPolicy(): RapidDrainPolicy;
  designatedBillingOrganisations(): DesignatedBillingOrganisations;
  /** The hold duration in force: 24 hours, or 24 seconds under the labelled demo compression. */
  holdDurationMs(): number;
}
