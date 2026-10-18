import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DEFAULT_RAPID_DRAIN_POLICY, type InterventionState } from '@sentinel/domain';
import { InstitutionLabelPipe } from '../../../../shared/pipes/institution-label/institution-label-pipe';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import { RiskBandBadge } from '../../../../shared/ui/risk-band-badge/risk-band-badge';
import type { TapeRow } from '../../../../workers/transaction-worker-protocol';

/**
 * One transaction as the gate recorded it: its metadata, the deterministic policy decision with its rule and
 * versions, and the rapid-drain arithmetic behind it. Nothing here is computed beyond a bar width.
 */
@Component({
  selector: 'sentinel-transaction-detail',
  imports: [DatePipe, DecimalPipe, InstitutionLabelPipe, MinorUnitsCurrencyPipe, Icon, RiskBandBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let item = row();
    <section class="panel" aria-labelledby="detail-title">
      <header>
        <h2 id="detail-title">Transaction details</h2>
        <button type="button" class="close sentinel-icon-button" (click)="closed.emit()">
          <sentinel-icon name="close" [size]="18" label="Close transaction details" />
        </button>
      </header>

      <div class="identity">
        <span class="glyph" [attr.data-decision]="item.decision" aria-hidden="true">
          <sentinel-icon [name]="item.decision === 'ALLOW' ? 'arrowRight' : 'arrowUpRight'" [size]="20" />
        </span>
        <span class="mono txn">{{ item.transactionId }}</span>
        <sentinel-risk-band-badge [band]="item.band" />
      </div>

      <dl class="facts">
        <div><dt>Time (SGT)</dt><dd class="mono">{{ item.occurredAt | date: 'HH:mm:ss' : '+0800' }}</dd></div>
        <div><dt>Amount</dt><dd class="mono strong">{{ item.amount | minorUnitsCurrency }}</dd></div>
        <div><dt>From</dt><dd><span class="mono">{{ item.accountReference ?? item.accountId }}</span></dd></div>
        <div><dt>Route</dt><dd>{{ item.institutionId | institutionLabel }} → {{ item.destinationInstitutionId | institutionLabel }}</dd></div>
        <div><dt>Risk score</dt><dd><b class="mono" [attr.data-band]="item.band">{{ item.score }}</b> / 100</dd></div>
        <div><dt>Status</dt><dd>{{ status() ? statusLabel[status()!] : 'No intervention' }}</dd></div>
      </dl>

      <div class="decision-box" [attr.data-decision]="item.decision">
        <div class="decision-row">
          <span class="decision-pill">
            <sentinel-icon [name]="item.decision === 'ALLOW' ? 'shieldCheck' : 'lock'" [size]="16" />
            {{ item.decision }}
          </span>
          <span class="stack">
            <span class="caption">Deterministic decision · rules engine</span>
            <span class="sub">Policy {{ item.policyVersion }} · ruleset {{ item.rulesetVersion }}</span>
          </span>
        </div>
        @for (code of item.reasonCodes; track code) {
          <span class="mono rule">{{ code }}</span>
        }
        @if (item.cascadeOfTransactionId) {
          <p class="sub">Held under the SG-RD-50 cascade after {{ item.cascadeOfTransactionId }} breached the gate.</p>
        }
        @if (item.holdUntil) {
          <p class="sub">Auto-release due {{ item.holdUntil | date: 'HH:mm:ss · d MMM' : '+0800' }} SGT</p>
        }
      </div>

      <div class="drain">
        <div class="drain-head">
          <span class="caption">Rapid-drain analysis</span>
          <b class="mono" [class.over]="item.drain.thresholdMet">{{ item.drain.drainPct | number: '1.1-1' }}%</b>
        </div>
        <div class="meter" role="img" [attr.aria-label]="'24-hour drain ' + (item.drain.drainPct | number: '1.1-1') + '% against a ' + gatePercent + '% threshold'">
          <span class="fill" [class.over]="item.drain.thresholdMet" [style.width.%]="fill()"></span>
          <span class="threshold" [style.left.%]="gatePercent"></span>
        </div>
        <p class="sub figures">
          <b class="mono">{{ item.drain.outflow24h | minorUnitsCurrency }}</b> moved of
          <b class="mono">{{ item.drain.balanceAtWindowStart | minorUnitsCurrency }}</b> opening balance · threshold {{ gatePercent }}%
        </p>
        @if (item.drain.excluded) {
          <p class="sub">Excluded from the gate{{ item.drain.exclusionReason ? ': ' + item.drain.exclusionReason : '' }}.</p>
        }
      </div>

      <button type="button" class="primary" title="Opens the workspace on this account's latest assessment" (click)="investigate.emit(item.accountId)">
        Open investigation
        <sentinel-icon name="arrowRight" [size]="18" />
      </button>
    </section>
  `,
  styleUrl: './transaction-detail.css',
})
export class TransactionDetail {
  readonly row = input.required<TapeRow>();
  readonly status = input<InterventionState | undefined>(undefined);
  readonly closed = output<void>();
  readonly investigate = output<string>();

  protected readonly gatePercent = DEFAULT_RAPID_DRAIN_POLICY.gatePercent;
  protected readonly statusLabel: Readonly<Record<InterventionState, string>> = {
    HELD: 'Held',
    RELEASED: 'Released',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
  };
  /** The meter is the drain against 100% of the opening balance, capped at the bar's end. */
  protected readonly fill = computed(() => Math.max(0, Math.min(100, this.row().drain.drainPct)));
}
