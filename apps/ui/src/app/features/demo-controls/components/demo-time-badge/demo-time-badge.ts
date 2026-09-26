import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DEMO_TIME_COMPRESSION_FACTOR } from '@sentinel/domain';

/** Visible whenever the 24-hour hold is compressed, so nobody can say the control was misrepresented. */
@Component({
  selector: 'sentinel-demo-time-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (enabled()) {
      <span class="badge sentinel-figures" title="24 hours of policy time run as 24 seconds in this demo">
        demo time ×{{ factor }}
      </span>
    }
  `,
  styles: `
    .badge {
      display: inline-block;
      padding: 2px var(--sentinel-space-2);
      border: 1px solid var(--sentinel-color-risk-elevated);
      border-radius: var(--sentinel-radius-pill);
      color: var(--sentinel-color-risk-elevated);
      font-size: var(--sentinel-font-size-caption);
      font-family: var(--sentinel-font-family-mono);
    }
  `,
})
export class DemoTimeBadge {
  readonly enabled = input(false);
  protected readonly factor = DEMO_TIME_COMPRESSION_FACTOR;
}
