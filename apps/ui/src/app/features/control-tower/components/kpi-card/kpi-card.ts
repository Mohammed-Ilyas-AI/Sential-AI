import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Icon } from '../../../../shared/ui/icon/icon';
import { Sparkline } from '../../../../shared/ui/sparkline/sparkline';
import type { KpiView } from '../../models/operations-overview';

/** A compact headline counter: what it is and how it is moving on top, the figure and its trend below. */
@Component({
  selector: 'sentinel-kpi-card',
  imports: [DecimalPipe, Icon, Sparkline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-tone]': 'kpi().tone' },
  template: `
    <div class="head">
      <span class="tile"><sentinel-icon [name]="kpi().icon" [size]="16" /></span>
      <span class="label">{{ kpi().label }}</span>
      <span class="change sentinel-mono" [attr.data-direction]="direction()">
        @if (kpi().changePercent === null) {
          new
        } @else if (direction() === 'flat') {
          — 0%
        } @else {
          {{ direction() === 'up' ? '↑' : '↓' }}
          @if (absoluteChange() > 999) {
            >999%
          } @else {
            {{ absoluteChange() | number: '1.0-1' }}%
          }
        }
      </span>
    </div>
    <div class="figures">
      <span class="value sentinel-mono">{{ kpi().value | number }}</span>
      <sentinel-sparkline class="trend" [values]="kpi().series" [variant]="kpi().id === 'transactions' ? 'bars' : 'line'" />
    </div>
  `,
  styleUrl: './kpi-card.css',
})
export class KpiCard {
  readonly kpi = input.required<KpiView>();

  protected readonly direction = computed(() => {
    const change = this.kpi().changePercent;
    if (change === null || change === 0) return 'flat';
    return change > 0 ? 'up' : 'down';
  });
  protected readonly absoluteChange = computed(() => Math.abs(this.kpi().changePercent ?? 0));
}
