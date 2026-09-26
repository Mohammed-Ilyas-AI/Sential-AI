import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RAPID_DRAIN_GATE_PERCENT } from '@sentinel/domain';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { RiskBandBadge } from '../../../../shared/ui/risk-band-badge/risk-band-badge';
import { FraudAlertsFacade } from '../../data-access/fraud-alerts-facade';

/** The HTML reference colours the meter amber above 35% drain; the gate line itself is the policy percentage. */
const DRAIN_METER_NEAR_PERCENT = 35;

/** Right rail: balance at window start, 24h transferred, drain against the 50% line, score, band and signals. */
@Component({
  selector: 'sentinel-account-risk-panel',
  imports: [DecimalPipe, MinorUnitsCurrencyPipe, RiskBandBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="account-risk-title">
      <h2 id="account-risk-title">Rapid-drain state</h2>
      @if (facade.selectedAccount(); as account) {
        <p class="account">
          {{ account.accountReference ?? account.accountId }}
          <span class="status" [attr.data-state]="drainState()">{{ drainLabel() }}</span>
        </p>
        <dl>
          <dt>Balance at window start</dt>
          <dd>{{ account.balanceAtWindowStart | minorUnitsCurrency }}</dd>
          <dt>Transferred, rolling 24h</dt>
          <dd>{{ account.transferredLast24h | minorUnitsCurrency }}</dd>
          <dt>Drain</dt>
          <dd>{{ account.drainPct | number: '1.1-1' }}%</dd>
        </dl>
        <div
          class="meter"
          role="meter"
          aria-label="Drain against the policy threshold"
          [attr.aria-valuenow]="account.drainPct"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div class="track">
            <span class="fill" [attr.data-state]="meterState()" [style.width.%]="meterWidth()"></span>
            <span class="threshold" [style.left.%]="gatePercent"></span>
          </div>
          <div class="scale sentinel-figures">
            <span>0%</span><span>{{ gatePercent }}% gate</span><span>100%</span>
          </div>
        </div>
        <p class="score">
          Advisory score <b class="sentinel-figures">{{ account.score }}</b>
          <sentinel-risk-band-badge [band]="account.band" />
        </p>
        <ul class="signals" aria-label="Signals">
          <li [class.on]="account.signals.newDevice">New device</li>
          <li [class.on]="account.signals.newPayee">New payee</li>
          <li [class.on]="account.signals.velocityAnomaly">Velocity</li>
          <li [class.on]="account.signals.destinationPreviouslyFlagged">Flagged destination</li>
          <li [class.on]="account.signals.coolingOffActive">Cooling-off</li>
        </ul>
      } @else {
        <p class="empty">Select an alert or a transaction to see its account.</p>
      }
    </section>
  `,
  styles: `
    .card {
      background: var(--sentinel-color-surface);
      border: 1px solid var(--sentinel-color-border);
      border-radius: var(--sentinel-radius-medium);
      padding: var(--sentinel-space-4);
      box-shadow: var(--sentinel-elevation-panel);
    }
    h2 {
      margin: 0 0 var(--sentinel-space-2);
      font-size: var(--sentinel-font-size-body);
    }
    .account {
      display: flex;
      justify-content: space-between;
      margin: 0 0 var(--sentinel-space-3);
      font-family: var(--sentinel-font-family-mono);
    }
    .status {
      font-family: var(--sentinel-font-family-sans);
      font-size: var(--sentinel-font-size-caption);
      font-weight: 600;
    }
    [data-state='over'] { color: var(--sentinel-color-risk-critical); }
    [data-state='near'] { color: var(--sentinel-color-risk-elevated); }
    [data-state='under'],
    [data-state='unprotected'],
    [data-state='excluded'] { color: var(--sentinel-color-text-muted); }
    dl {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--sentinel-space-1) var(--sentinel-space-4);
      margin: 0;
      font-size: var(--sentinel-font-size-caption);
    }
    dt,
    .empty,
    .scale {
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-caption);
    }
    dd {
      margin: 0;
      text-align: right;
      font-family: var(--sentinel-font-family-mono);
    }
    .meter {
      margin-top: var(--sentinel-space-3);
    }
    .track {
      position: relative;
      height: 10px;
      border-radius: var(--sentinel-radius-small);
      background: var(--sentinel-color-border);
    }
    .fill {
      position: absolute;
      inset: 0 auto 0 0;
      border-radius: var(--sentinel-radius-small);
      background: var(--sentinel-color-risk-low);
      transition: width var(--sentinel-motion-duration-base) var(--sentinel-motion-easing-standard);
    }
    .fill[data-state='near'] { background: var(--sentinel-color-risk-elevated); }
    .fill[data-state='over'] { background: var(--sentinel-color-risk-critical); }
    .threshold {
      position: absolute;
      top: -4px;
      bottom: -4px;
      width: 2px;
      background: var(--sentinel-color-text);
    }
    .scale {
      display: flex;
      justify-content: space-between;
      margin-top: var(--sentinel-space-1);
    }
    .score {
      display: flex;
      align-items: center;
      gap: var(--sentinel-space-2);
    }
    .signals {
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: var(--sentinel-space-1);
      margin: 0;
      padding: 0;
    }
    .signals li {
      padding: 1px var(--sentinel-space-2);
      border: 1px solid var(--sentinel-color-border);
      border-radius: var(--sentinel-radius-pill);
      font-size: var(--sentinel-font-size-caption);
      color: var(--sentinel-color-text-muted);
    }
    .signals li.on {
      color: var(--sentinel-color-text);
      border-color: var(--sentinel-color-accent);
    }
  `,
})
export class AccountRiskPanel {
  protected readonly facade = inject(FraudAlertsFacade);
  protected readonly gatePercent = RAPID_DRAIN_GATE_PERCENT;

  protected readonly drainState = computed(() => {
    const account = this.facade.selectedAccount();
    if (!account) return 'under';
    if (account.exclusionReason) return 'excluded';
    if (!account.protectedAccount) return 'unprotected';
    if (account.thresholdMet) return 'over';
    return account.drainPct > DRAIN_METER_NEAR_PERCENT ? 'near' : 'under';
  });

  /** The meter shows the raw drain, whatever the account's protection, exactly as the reference does. */
  protected readonly meterState = computed(() => {
    const drainPct = this.facade.selectedAccount()?.drainPct ?? 0;
    if (drainPct > this.gatePercent) return 'over';
    return drainPct > DRAIN_METER_NEAR_PERCENT ? 'near' : 'under';
  });

  protected readonly drainLabel = computed(() => {
    const account = this.facade.selectedAccount();
    switch (this.drainState()) {
      case 'excluded':
        return `Excluded (${account?.exclusionReason ?? ''})`;
      case 'unprotected':
        return 'Below protected balance';
      case 'over':
        return 'Threshold exceeded';
      case 'near':
        return 'Approaching threshold';
      default:
        return 'Protected · under threshold';
    }
  });

  protected readonly meterWidth = computed(() => Math.min(100, Math.max(0, this.facade.selectedAccount()?.drainPct ?? 0)));
}
