import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { AnalyticsFacade, type Bar } from '../../data-access/analytics-facade';

/** Analytics & reports (M§5.8): what the control did, counted from the session's own records. */
@Component({
  selector: 'sentinel-analytics-page',
  imports: [PageHeader, MinorUnitsCurrencyPipe, DecimalPipe],
  providers: [AnalyticsFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sentinel-page-header
      heading="Analytics & reports"
      summary="Measured outcomes of the control over the live tape (latest 200 decisions) and every intervention record. Counted, never modelled."
    />
    <div class="sentinel-workspace">
      <div class="sentinel-stats">
        <div class="sentinel-panel sentinel-stat"><span class="sentinel-stat__value">{{ facade.decisions() }}</span><span class="sentinel-stat__label">Transfers decided</span></div>
        <div class="sentinel-panel sentinel-stat"><span class="sentinel-stat__value">{{ facade.valueScreened() | minorUnitsCurrency }}</span><span class="sentinel-stat__label">Value screened</span></div>
        <div class="sentinel-panel sentinel-stat"><span class="sentinel-stat__value critical">{{ facade.valueHeld() | minorUnitsCurrency }}</span><span class="sentinel-stat__label">Value held before it left</span></div>
        <div class="sentinel-panel sentinel-stat"><span class="sentinel-stat__value">{{ facade.holdRate() | number: '1.1-1' }}%</span><span class="sentinel-stat__label">Hold rate ({{ facade.holds() }} of {{ facade.decisions() }})</span></div>
      </div>

      <div class="charts">
        @for (chart of charts(); track chart.id) {
          <section class="sentinel-panel sentinel-section" [attr.aria-labelledby]="chart.id">
            <header><h2 [id]="chart.id">{{ chart.title }}</h2><span class="sentinel-muted">{{ chart.note }}</span></header>
            @if (chart.bars.length === 0) {
              <p class="sentinel-empty">Nothing to count yet.</p>
            } @else {
              <ul class="bars">
                @for (bar of chart.bars; track bar.key) {
                  <li [title]="bar.label + ': ' + bar.value">
                    <span class="label">{{ bar.label }}</span>
                    <span class="track"><span class="fill" [attr.data-tone]="bar.tone ?? null" [style.width.%]="bar.share"></span></span>
                    <span class="value">{{ bar.value }}</span>
                  </li>
                }
              </ul>
            }
          </section>
        }
        <section class="sentinel-panel sentinel-section throughput" aria-labelledby="throughput-title">
          <header><h2 id="throughput-title">Decisions per minute</h2><span class="sentinel-muted">Last 30 minutes with traffic, UTC</span></header>
          @if (facade.perMinute().length === 0) {
            <p class="sentinel-empty">No traffic yet.</p>
          } @else {
            <div class="columns" role="list">
              @for (bucket of facade.perMinute(); track bucket[0]) {
                <div class="column" role="listitem" [title]="bucket[0].slice(11) + ' UTC · ' + bucket[1] + ' decisions'">
                  <span class="column-fill" [style.height.%]="(bucket[1] / peak()) * 100"></span>
                  <span class="column-label">{{ bucket[0].slice(11) }}</span>
                </div>
              }
            </div>
          }
        </section>
      </div>
    </div>
  `,
  styles: `
    .critical { color: var(--sentinel-color-critical-text); }
    .charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: var(--sentinel-space-4); }
    .bars { display: grid; gap: var(--sentinel-space-2); margin: 0; padding: 0; list-style: none; }
    .bars li { display: grid; grid-template-columns: minmax(110px, 38%) 1fr 48px; align-items: center; gap: var(--sentinel-space-3); font-size: var(--sentinel-font-size-caption); }
    .label { color: var(--sentinel-color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .track { height: 12px; }
    .fill { display: block; height: 100%; min-width: 2px; border-radius: 0 4px 4px 0; background: var(--sentinel-color-series); }
    .fill[data-tone='critical'] { background: var(--sentinel-color-hold); }
    .fill[data-tone='success'] { background: var(--sentinel-color-success); }
    .fill[data-tone='warning'] { background: var(--sentinel-color-warning); }
    .value { text-align: right; font-family: var(--sentinel-font-family-mono); }
    .throughput { grid-column: 1 / -1; }
    .columns { display: flex; align-items: flex-end; gap: 2px; height: 140px; padding-bottom: 18px; }
    .column { position: relative; flex: 0 1 48px; height: 100%; display: flex; align-items: flex-end; }
    .column-fill { width: 100%; min-height: 2px; border-radius: 4px 4px 0 0; background: var(--sentinel-color-series); }
    .column-label { position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%); color: var(--sentinel-color-text-secondary); font-size: var(--sentinel-font-size-micro); white-space: nowrap; }
    .column:not(:first-child):not(:last-child) .column-label { display: none; }
  `,
})
export class AnalyticsPage {
  protected readonly facade = inject(AnalyticsFacade);
  protected readonly peak = computed(() => Math.max(1, ...this.facade.perMinute().map(([, count]) => count)));
  protected readonly charts = computed((): readonly { id: string; title: string; note: string; bars: readonly Bar[] }[] => [
    { id: 'decision-mix', title: 'Decisions', note: 'The gate decides', bars: this.facade.byDecision() },
    { id: 'band-mix', title: 'Advisory risk band', note: 'The score ranks; it never decides', bars: this.facade.byBand() },
    { id: 'outcomes', title: 'Hold outcomes', note: 'Latest state per held transfer', bars: this.facade.outcomes() },
    { id: 'rules', title: 'Risk points by rule', note: 'Latest decision per account', bars: this.facade.rulePoints() },
  ]);
}
