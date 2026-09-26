import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { RiskBand } from '@sentinel/domain';

/** The band is always written as text as well as colour, so it survives a poor projector. */
@Component({
  selector: 'sentinel-risk-band-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [attr.data-band]="band()">{{ band() }}</span>`,
  styles: `
    [data-band='LOW'] { color: var(--sentinel-color-risk-low); }
    [data-band='ELEVATED'] { color: var(--sentinel-color-risk-elevated); }
    [data-band='HIGH'] { color: var(--sentinel-color-risk-high); }
    [data-band='CRITICAL'] { color: var(--sentinel-color-risk-critical); }
  `,
})
export class RiskBandBadge {
  readonly band = input.required<RiskBand>();
}
