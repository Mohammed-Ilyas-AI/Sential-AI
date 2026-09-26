import type { DesignatedBillingOrganisations, RapidDrainPolicy } from '@sentinel/domain';
import type { PolicyConfiguration } from '../../modules/policy/application/ports/policy-configuration.port.js';

export class RuntimePolicyConfiguration implements PolicyConfiguration {
  private readonly billingOrganisations: DesignatedBillingOrganisations;

  constructor(
    private readonly policy: RapidDrainPolicy,
    designatedBillingPayeeIds: ReadonlySet<string>,
  ) {
    this.billingOrganisations = { isDesignated: (payeeId) => designatedBillingPayeeIds.has(payeeId) };
  }

  rapidDrainPolicy(): RapidDrainPolicy {
    return this.policy;
  }

  designatedBillingOrganisations(): DesignatedBillingOrganisations {
    return this.billingOrganisations;
  }
}
