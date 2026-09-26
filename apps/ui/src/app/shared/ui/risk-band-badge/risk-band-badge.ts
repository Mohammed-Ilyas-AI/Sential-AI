import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { RiskBand } from '@sentinel/domain';

/** The band is always written as text as well as colour, so it survives a poor projector. */
@Component({
  selector: 'sentinel-risk-band-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [attr.data-band]="band()">{{ band() }}</span>`,
  styles: `
    .badge {
      display: inline-block;
      padding: 1px var(--sentinel-space-2);
      border: 1px solid currentColor;
      border-radius: var(--sentinel-radius-pill);
      font-size: var(--sentinel-font-size-caption);
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    [data-band='LOW'] { color: var(--sentinel-color-risk-low); }
    [data-band='ELEVATED'] { color: var(--sentinel-color-risk-elevated); }
    [data-band='HIGH'] { color: var(--sentinel-color-risk-high); }
    [data-band='CRITICAL'] { color: var(--sentinel-color-risk-critical); }
  `,
})
export class RiskBandBadge {
  readonly band = input.required<RiskBand>();
}
