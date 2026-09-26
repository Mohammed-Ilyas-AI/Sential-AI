import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DEMO_TIME_COMPRESSION_FACTOR } from '@sentinel/domain';

/** Visible whenever the 24-hour hold is compressed, so nobody can say the control was misrepresented. */
@Component({
  selector: 'sentinel-demo-time-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (enabled()) {
      <span>demo time ×{{ factor }}</span>
    }
  `,
})
export class DemoTimeBadge {
  readonly enabled = input(false);
  protected readonly factor = DEMO_TIME_COMPRESSION_FACTOR;
}
