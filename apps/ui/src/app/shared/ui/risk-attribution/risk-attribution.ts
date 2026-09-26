import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Contribution } from '@sentinel/domain';

/**
 * "Why did you stop this transaction?" Renders contributions[] exactly as the engine wrote them: no
 * transformation, no inference, no recomputed score.
 */
@Component({
  selector: 'sentinel-risk-attribution',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-label="Risk attribution"></section>`,
})
export class RiskAttribution {
  readonly contributions = input.required<readonly Contribution[]>();
  readonly score = input.required<number>();
}
