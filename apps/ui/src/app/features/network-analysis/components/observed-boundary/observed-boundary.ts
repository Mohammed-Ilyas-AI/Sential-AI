import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** States plainly what the graph can and cannot see. Fixed wording: synthetic data, no real network integration. */
@Component({
  selector: 'sentinel-observed-boundary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p>
      Observed two hops from the account across participating institutions{{ truncated() ? ', capped at 40 entities (least significant links dropped)' : '' }}.
      Activity at non-participating institutions is not visible. Candidate and unobserved links are drawn dashed and never score.
    </p>
    <p class="sentinel-muted">COSMIC-inspired cross-institutional intelligence, demonstrated on synthetic, privacy-safe data. No real bank or COSMIC integration.</p>
  `,
  styles: `
    p { margin: 0 0 var(--sentinel-space-2); font-size: var(--sentinel-font-size-caption); line-height: var(--sentinel-line-height-body); }
  `,
})
export class ObservedBoundary {
  readonly truncated = input(false);
}
