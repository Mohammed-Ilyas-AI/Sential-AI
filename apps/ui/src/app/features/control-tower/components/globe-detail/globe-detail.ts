import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import { RiskBandBadge } from '../../../../shared/ui/risk-band-badge/risk-band-badge';
import type { GlobeAction, GlobeDetail } from '../../models/operations-overview';

/**
 * The selected globe target in a small panel: what it is, the figures the tape holds for it, and the actions it
 * supports, each one a real route or state change. A transfer shows its recorded policy decision and its
 * current intervention state as two separate facts: a historical HOLD may since have been RELEASED.
 */
@Component({
  selector: 'sentinel-globe-detail',
  imports: [MinorUnitsCurrencyPipe, Icon, RiskBandBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let item = detail();
    <section class="panel" [attr.aria-label]="'Selected ' + item.kind" [attr.data-kind]="item.kind">
      <header>
        <span class="kind">{{ item.kind === 'bank' ? 'Bank' : item.kind === 'account' ? 'Account' : 'Transfer' }}</span>
        <button type="button" class="close" aria-label="Reset global view" title="Reset global view" (click)="closed.emit()">
          <sentinel-icon name="close" [size]="14" />
        </button>
      </header>
      @switch (item.kind) {
        @case ('bank') {
          <p class="title">{{ item.label }} @if (item.focused) { <span class="chip">Tower focused</span> }</p>
          <dl class="grid">
            <div><dt>Sent</dt><dd>{{ item.transfersOut }}</dd></div>
            <div><dt>Received</dt><dd>{{ item.transfersIn }}</dd></div>
            <div><dt>Held / rejected</dt><dd>{{ item.held }}</dd></div>
            <div><dt>Accounts</dt><dd>{{ item.accounts }}</dd></div>
          </dl>
          <div class="actions">
            @if (item.focused) {
              <button type="button" (click)="action.emit({ type: 'clear-bank' })">Show all banks</button>
            } @else {
              <button type="button" (click)="action.emit({ type: 'focus-bank', id: item.id })">Focus tower</button>
            }
            <button type="button" class="primary" (click)="action.emit({ type: 'bank-transactions', id: item.id })">Transactions</button>
          </div>
        }
        @case ('transaction') {
          <p class="title mono">{{ item.id }}</p>
          <p class="sub">{{ item.account }} · {{ item.from }} → {{ item.to }} · <b>{{ item.amount | minorUnitsCurrency }}</b></p>
          <p class="sub">Score <b>{{ item.score }}</b> <sentinel-risk-band-badge [band]="item.band" /></p>
          <div class="facts">
            <span class="fact" [attr.data-decision]="item.decision"><span>Policy decision</span><b>{{ item.decision }}</b></span>
            <span class="fact" [attr.data-state]="item.interventionState ?? 'NONE'">
              <span>Intervention</span><b>{{ item.interventionState ?? 'None' }}</b>
            </span>
          </div>
          <div class="actions">
            <button type="button" (click)="action.emit({ type: 'open-transaction', id: item.id })">Details</button>
            @if (item.hasAlert) {
              <button type="button" (click)="action.emit({ type: 'open-alert', accountId: item.accountId })">Alert</button>
            }
            <button type="button" class="primary" (click)="action.emit({ type: 'open-investigation', accountId: item.accountId })">Investigate</button>
          </div>
        }
        @case ('account') {
          <p class="title mono">{{ item.account }}</p>
          <p class="sub">{{ item.institution }} · {{ item.transfers }} {{ item.transfers === 1 ? 'transfer' : 'transfers' }} on the tape</p>
          <p class="sub">Latest: <b>{{ item.latestDecision }}</b> · score <b>{{ item.latestScore }}</b> <sentinel-risk-band-badge [band]="item.band" /></p>
          <div class="actions">
            @if (item.hasAlert) {
              <button type="button" (click)="action.emit({ type: 'open-alert', accountId: item.id })">Alert &amp; case</button>
            }
            <button type="button" class="primary" (click)="action.emit({ type: 'open-investigation', accountId: item.id })">Investigate</button>
          </div>
        }
      }
    </section>
  `,
  styleUrl: './globe-detail.css',
})
export class GlobeDetailPanel {
  readonly detail = input.required<GlobeDetail>();
  readonly action = output<GlobeAction>();
  readonly closed = output<void>();
}
