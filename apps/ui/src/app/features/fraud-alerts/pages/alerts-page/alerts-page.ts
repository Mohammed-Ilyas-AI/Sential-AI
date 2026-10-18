import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RAPID_DRAIN_GATE_PERCENT } from '@sentinel/domain';
import { DecisionTrace } from '../../../../shared/ui/decision-trace/decision-trace';
import { Icon } from '../../../../shared/ui/icon/icon';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { RiskBandBadge } from '../../../../shared/ui/risk-band-badge/risk-band-badge';
import { AlertQueue } from '../../components/alert-queue/alert-queue';
import { CaseDetail } from '../../components/case-detail/case-detail';
import { FraudAlertsFacade } from '../../data-access/fraud-alerts-facade';

/**
 * The analyst's working view: four headline figures, the alert queue and the selected alert as a case, with
 * the gate's recorded decision kept apart from what the intervention record says now.
 */
@Component({
  selector: 'sentinel-alerts-page',
  imports: [DecimalPipe, PageHeader, AlertQueue, CaseDetail, DecisionTrace, Icon, RiskBandBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'traceOpen.set(false)' },
  template: `
    <sentinel-page-header heading="Alerts & Cases" summary="Prioritise alerts, inspect policy decisions and track intervention status." />

    <section class="metrics" aria-label="Alert figures">
      <div class="metric" data-tone="critical">
        <span class="tile"><sentinel-icon name="alert" [size]="20" /></span>
        <span class="text"><span class="label">Open alerts</span><b class="sentinel-figures">{{ facade.queue().length }}</b></span>
      </div>
      <div class="metric" data-tone="high">
        <span class="tile"><sentinel-icon name="analytics" [size]="20" /></span>
        <span class="text">
          <span class="label">Selected risk score</span>
          @if (facade.focusedDecision(); as decision) {
            <span class="value"><b class="sentinel-figures">{{ decision.riskScore }}</b><sentinel-risk-band-badge [band]="decision.band" /></span>
          } @else {
            <b>—</b>
          }
        </span>
      </div>
      <div class="metric" data-tone="info">
        <span class="tile"><sentinel-icon name="trendUp" [size]="20" /></span>
        <span class="text">
          <span class="label">24h balance drain</span>
          @if (facade.selectedAccount(); as account) {
            <span class="value"><b class="sentinel-figures">{{ account.drainPct | number: '1.1-1' }}%</b><span class="hint">gate &gt; {{ gatePercent }}%</span></span>
          } @else {
            <b>—</b>
          }
        </span>
      </div>
      <div class="metric" data-tone="success">
        <span class="tile"><sentinel-icon name="transfer" [size]="20" /></span>
        <span class="text">
          <span class="label">Active held transfers</span>
          <span class="value"><b class="sentinel-figures">{{ facade.focusedHolds().length }}</b><span class="hint">on the selected account</span></span>
        </span>
      </div>
    </section>

    <div class="layout">
      <sentinel-alert-queue />
      <sentinel-case-detail (trace)="traceOpen.set(true)" />
    </div>

    @if (traceOpen()) {
      @if (facade.focusedDecision(); as decision) {
        <div class="scrim" (click)="traceOpen.set(false)" aria-hidden="true"></div>
        <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="trace-title">
          <header>
            <h2 id="trace-title">Decision trace</h2>
            <button type="button" class="close" (click)="traceOpen.set(false)"><sentinel-icon name="close" [size]="18" label="Close" /></button>
          </header>
          <p class="note">The gate's outcome as a fact: rule, reason, source and versions. Never a probability.</p>
          <sentinel-decision-trace [decision]="decision" />
        </section>
      }
    }
  `,
  styleUrl: './alerts-page.css',
})
export class AlertsPage {
  protected readonly facade = inject(FraudAlertsFacade);
  protected readonly gatePercent = RAPID_DRAIN_GATE_PERCENT;
  protected readonly traceOpen = signal(false);
}
