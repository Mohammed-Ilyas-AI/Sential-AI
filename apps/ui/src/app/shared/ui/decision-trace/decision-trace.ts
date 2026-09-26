import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { DecisionRecord } from '@sentinel/domain';

/**
 * A policy outcome is a fact, never a probability: rule SG-RD-50, the evidence, the decision source and the
 * ruleset and policy versions. Never a confidence figure.
 */
@Component({
  selector: 'sentinel-decision-trace',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-label="Decision trace"></section>`,
})
export class DecisionTrace {
  readonly decision = input.required<DecisionRecord>();
}
