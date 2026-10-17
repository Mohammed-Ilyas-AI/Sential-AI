import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DEFAULT_RAPID_DRAIN_POLICY } from '@sentinel/domain';
import { InstitutionLabelPipe } from '../../../../shared/pipes/institution-label/institution-label-pipe';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { RiskBandBadge } from '../../../../shared/ui/risk-band-badge/risk-band-badge';
import { AccountsFacade } from '../../data-access/accounts-facade';

/** Accounts (M§5.2): every account on the stream, its rolling 24-hour drain against the SG-RD-50 line. */
@Component({
  selector: 'sentinel-accounts-page',
  imports: [PageHeader, RiskBandBadge, InstitutionLabelPipe, MinorUnitsCurrencyPipe, DecimalPipe],
  providers: [AccountsFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sentinel-page-header
      heading="Accounts"
      summary="Every account on the stream with its rolling 24-hour window, measured against the SG-RD-50 line. Select one to work it in Alerts & cases."
    />
    <div class="sentinel-workspace">
      <div class="sentinel-stats">
        <div class="sentinel-panel sentinel-stat">
          <span class="sentinel-stat__value">{{ facade.accounts().length }}</span><span class="sentinel-stat__label">Accounts monitored</span>
        </div>
        <div class="sentinel-panel sentinel-stat">
          <span class="sentinel-stat__value critical">{{ facade.overGate() }}</span><span class="sentinel-stat__label">Over the {{ gate }}% drain gate</span>
        </div>
        <div class="sentinel-panel sentinel-stat">
          <span class="sentinel-stat__value">{{ facade.withHolds() }}</span><span class="sentinel-stat__label">With a hold in force</span>
        </div>
        <div class="sentinel-panel sentinel-stat">
          <span class="sentinel-stat__value">{{ facade.withAlerts() }}</span><span class="sentinel-stat__label">With an open alert</span>
        </div>
      </div>

      <section class="sentinel-panel sentinel-section" aria-labelledby="accounts-title">
        <header>
          <h2 id="accounts-title">Accounts by risk</h2>
          <span class="sentinel-muted">Drain is the latest decision's own snapshot; the gate holds above {{ gate }}%.</span>
        </header>
        @if (facade.accounts().length === 0) {
          <p class="sentinel-empty">No account has transacted yet. Start the simulator to stream the synthetic banks.</p>
        } @else {
          <div class="sentinel-table-wrap">
            <table class="sentinel-table">
              <thead>
                <tr>
                  <th scope="col">Account</th>
                  <th scope="col">Bank</th>
                  <th scope="col" class="numeric">Balance at window start</th>
                  <th scope="col" class="numeric">Out, rolling 24h</th>
                  <th scope="col">Drain vs gate</th>
                  <th scope="col" class="numeric">Score</th>
                  <th scope="col">Latest</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span class="visually-hidden">Action</span></th>
                </tr>
              </thead>
              <tbody>
                @for (account of facade.accounts(); track account.accountId) {
                  <tr [class.over]="account.drain.thresholdMet">
                    <td class="mono">{{ account.reference }}</td>
                    <td>{{ account.institutionId | institutionLabel }}</td>
                    <td class="numeric mono">{{ account.drain.balanceAtWindowStart | minorUnitsCurrency }}</td>
                    <td class="numeric mono">{{ account.drain.outflow24h | minorUnitsCurrency }}</td>
                    <td class="drain">
                      <div class="sentinel-meter" role="img" [attr.aria-label]="'Drain ' + (account.drain.drainPct | number: '1.1-1') + ' percent'">
                        <span [style.width.%]="account.drain.drainPct > 100 ? 100 : account.drain.drainPct" [class.hot]="account.drain.thresholdMet"></span>
                        <i class="gate" [style.left.%]="gate" aria-hidden="true"></i>
                      </div>
                      <span class="mono">{{ account.drain.drainPct | number: '1.1-1' }}%</span>
                      @if (account.drain.excluded) {
                        <span class="sentinel-chip">excluded · {{ account.drain.exclusionReason }}</span>
                      }
                    </td>
                    <td class="numeric"><span class="score"><span class="mono">{{ account.latest.riskScore }}</span><sentinel-risk-band-badge [band]="account.band" /></span></td>
                    <td><span class="decision" [attr.data-decision]="account.latest.decision">{{ account.latest.decision }}</span></td>
                    <td class="status">
                      @if (account.activeHolds > 0) {
                        <span class="sentinel-chip" data-tone="critical">{{ account.activeHolds }} held</span>
                      }
                      @if (account.openAlert) {
                        <span class="sentinel-chip" data-tone="warning">alert open</span>
                      }
                      @if (account.activeHolds === 0 && !account.openAlert) {
                        <span class="sentinel-chip" data-tone="success">clear</span>
                      }
                      <span class="sentinel-muted">{{ account.transfers }} on tape</span>
                    </td>
                    <td><button type="button" class="sentinel-link-button" (click)="facade.focus(account.accountId)">Work account →</button></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>
  `,
  styles: `
    .mono { font-family: var(--sentinel-font-family-mono); }
    .critical { color: var(--sentinel-color-critical-text); }
    tr.over td:first-child { box-shadow: inset 3px 0 0 var(--sentinel-color-hold); }
    .drain { display: grid; grid-template-columns: minmax(90px, 140px) auto; align-items: center; gap: var(--sentinel-space-1) var(--sentinel-space-2); }
    .drain .sentinel-chip { grid-column: 1 / -1; justify-self: start; }
    .sentinel-meter { overflow: visible; }
    .sentinel-meter .hot { background: var(--sentinel-color-hold); }
    .gate { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--sentinel-color-text); }
    .score { display: inline-flex; align-items: center; gap: var(--sentinel-space-2); white-space: nowrap; }
    .status { display: flex; flex-wrap: wrap; gap: var(--sentinel-space-1); align-items: center; }
    .decision { font-weight: 600; }
    .decision[data-decision='HOLD'] { color: var(--sentinel-color-hold); }
    .decision[data-decision='ALLOW'] { color: var(--sentinel-color-success); }
    .decision[data-decision='REJECT'] { color: var(--sentinel-color-critical-text); }
    .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  `,
})
export class AccountsPage {
  protected readonly facade = inject(AccountsFacade);
  protected readonly gate = DEFAULT_RAPID_DRAIN_POLICY.gatePercent;
}
