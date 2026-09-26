import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { DecisionRecord } from '@sentinel/domain';

/**
 * The intervention panel (M§5.3): the decision trace plus the analyst's exception actions — contact customer,
 * release after customer verification, kill switch. The analyst never approves or overturns the policy.
 */
@Component({
  selector: 'sentinel-policy-hold',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-label="Policy hold"></section>`,
})
export class PolicyHold {
  readonly hold = input<DecisionRecord | null>(null);
}
