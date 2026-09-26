import { DEMO_TIME_COMPRESSION_FACTOR, type DesignatedBillingOrganisations, type RapidDrainPolicy } from '@sentinel/domain';
import type { PolicyConfiguration } from '../../modules/policy/application/ports/policy-configuration.port.js';

const HOUR_MS = 3_600_000;

export class RuntimePolicyConfiguration implements PolicyConfiguration {
  private readonly billingOrganisations: DesignatedBillingOrganisations;

  constructor(
    private readonly policy: RapidDrainPolicy,
    designatedBillingPayeeIds: ReadonlySet<string>,
    private readonly demoTimeCompression: boolean,
  ) {
    this.billingOrganisations = { isDesignated: (payeeId) => designatedBillingPayeeIds.has(payeeId) };
  }

  rapidDrainPolicy(): RapidDrainPolicy {
    return this.policy;
  }

  designatedBillingOrganisations(): DesignatedBillingOrganisations {
    return this.billingOrganisations;
  }

  holdDurationMs(): number {
    const full = this.policy.holdHours * HOUR_MS;
    return this.demoTimeCompression ? full / DEMO_TIME_COMPRESSION_FACTOR : full;
  }
}
