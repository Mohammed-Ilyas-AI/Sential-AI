import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import type { LiveMetricsView } from '../../models/live-metrics-view';

@Component({
  selector: 'sentinel-live-metrics',
  imports: [MinorUnitsCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-label="Live metrics">
      @if (metrics(); as metrics) {
        <div class="kpi">
          <span class="label">Transactions on tape</span>
          <span class="value">{{ metrics.transactionsScored }}</span>
        </div>
        <div class="kpi">
          <span class="label">Open alerts</span>
          <span class="value">{{ metrics.openAlerts }}</span>
        </div>
        <div class="kpi" [class.alarm]="metrics.transactionsOnHold > 0">
          <span class="label">On policy hold</span>
          <span class="value">{{ metrics.transactionsOnHold }}</span>
        </div>
        <div class="kpi">
          <span class="label">Value on hold</span>
          <span class="value">{{ metrics.valueOnHold | minorUnitsCurrency }}</span>
        </div>
      }
    </section>
  `,
  styles: `
    section {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      gap: var(--sentinel-space-3);
    }
    .kpi {
      display: flex;
      flex-direction: column;
      gap: var(--sentinel-space-1);
      padding: var(--sentinel-space-3);
      background: var(--sentinel-color-surface);
      border: 1px solid var(--sentinel-color-border);
      border-radius: var(--sentinel-radius-medium);
    }
    .label {
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-caption);
    }
    .value {
      font-family: var(--sentinel-font-family-mono);
      font-size: var(--sentinel-font-size-title);
      font-variant-numeric: tabular-nums;
    }
    .alarm .value {
      color: var(--sentinel-color-hold);
    }
  `,
})
export class LiveMetrics {
  readonly metrics = input<LiveMetricsView | null>(null);
}
