import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { LiveMetricsView } from '../../models/live-metrics-view';

@Component({
  selector: 'sentinel-live-metrics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-label="Live metrics"></section>`,
})
export class LiveMetrics {
  readonly metrics = input<LiveMetricsView | null>(null);
}
