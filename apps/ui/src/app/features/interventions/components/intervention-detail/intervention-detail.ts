import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { InstitutionLabelPipe } from '../../../../shared/pipes/institution-label/institution-label-pipe';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import { InterventionsFacade, type InterventionAction, type InterventionRow } from '../../data-access/interventions-facade';

type Tab = 'overview' | 'transaction' | 'audit';

const ACTIONS: readonly { readonly action: InterventionAction; readonly label: string; readonly confirm: string }[] = [
  { action: 'customer-verified-release', label: 'Release · customer verified', confirm: 'Record that the customer verified with the bank and release' },
  { action: 'customer-cancellation', label: 'Cancel · customer request', confirm: 'Record that the customer cancelled this transfer' },
  { action: 'fraud-confirmation', label: 'Confirm fraud', confirm: 'Confirm fraud and reject, recorded as' },
];

/**
 * The selected intervention. The policy decision and the current intervention state are two separate facts.
 * While a hold is in force, only sentinel-core's exception routes are offered, each behind a second explicit
 * confirmation; there is no release on judgement.
 */
@Component({
  selector: 'sentinel-intervention-detail',
  imports: [DatePipe, DecimalPipe, Icon, InstitutionLabelPipe, MinorUnitsCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (facade.selected(); as item) {
      <header>
        <span class="badge" [attr.data-state]="item.state"><sentinel-icon [name]="item.state === 'HELD' ? 'lock' : 'shieldCheck'" [size]="20" /></span>
        <div>
          <h2 class="mono">{{ item.transactionId }}</h2>
          <p class="caption">{{ item.reference }} · held {{ item.heldAt | date: 'd MMM y, HH:mm:ss' : 'UTC' }} UTC</p>
        </div>
        <span class="state" [attr.data-state]="item.state">{{ item.state }}</span>
        <button type="button" class="close" aria-label="Close intervention details" title="Close" (click)="facade.select(null)"><sentinel-icon name="close" [size]="16" /></button>
      </header>
      <nav class="tabs" role="tablist" aria-label="Intervention details">
        <button type="button" role="tab" [attr.aria-selected]="tab() === 'overview'" (click)="tab.set('overview')">Overview</button>
        <button type="button" role="tab" [attr.aria-selected]="tab() === 'transaction'" (click)="tab.set('transaction')">Transaction</button>
        <button type="button" role="tab" [attr.aria-selected]="tab() === 'audit'" (click)="tab.set('audit')">Audit trail ({{ item.history.length }})</button>
      </nav>
      <div class="body sentinel-scroll">
        @switch (tab()) {
          @case ('overview') {
            <div class="split">
              <dl>
                <div><dt>Latest record</dt><dd class="mono">{{ item.id.slice(0, 13) }}…</dd></div>
                <div><dt>Type</dt><dd>{{ item.kind === 'CASCADE' ? 'Hold cascade' : 'Threshold hold' }}</dd></div>
                <div><dt>Current state</dt><dd [attr.data-state]="item.state">{{ item.state }}</dd></div>
                <div><dt>Policy decision</dt><dd [attr.data-decision]="item.decided?.decision">{{ item.decided?.decision ?? 'Not on the live tape' }}</dd></div>
                <div><dt>Last action by</dt><dd>{{ actorLabel(item) }}</dd></div>
                <div><dt>Updated</dt><dd>{{ item.updatedAt | date: 'd MMM, HH:mm:ss' : 'UTC' }} UTC</dd></div>
                @if (item.holdUntil) {
                  <div><dt>Auto-release</dt><dd>{{ item.holdUntil | date: 'd MMM, HH:mm:ss' : 'UTC' }} UTC</dd></div>
                }
                <div><dt>Reason</dt><dd>{{ item.reasonCodes.join(', ') || '—' }}</dd></div>
                @if (item.cascadeOf) {
                  <div><dt>Cascade of</dt><dd class="mono">{{ item.cascadeOf }}</dd></div>
                }
              </dl>
              @if (item.decided; as decided) {
                <aside class="risk" [attr.data-band]="decided.band">
                  <span class="label">Risk score</span>
                  <b>{{ decided.score }}<small> / 100</small></b>
                  <span class="band">{{ decided.band }}</span>
                  <span class="policy">{{ decided.policyVersion }}<br />{{ decided.rulesetVersion }}</span>
                </aside>
              }
            </div>
            @if (item.state === 'HELD') {
              <section class="current" aria-label="Exceptions to the hold">
                <p><b>Current action:</b> this transfer is held. Only a customer-verified release, a customer cancellation or a fraud confirmation can move it.</p>
                @if (armed(); as choice) {
                  <div class="confirm" role="group" aria-label="Confirm action">
                    <span>{{ choice.confirm }}{{ choice.action === 'fraud-confirmation' ? ' ' + (facade.analystIdentity() ?? '') : '' }}?</span>
                    <button type="button" class="primary" [disabled]="facade.pendingAction() !== null" (click)="record(item, choice.action)">Record</button>
                    <button type="button" (click)="armed.set(null)">Back</button>
                  </div>
                } @else {
                  <div class="exceptions">
                    @for (option of actions; track option.action) {
                      <button type="button" [attr.data-action]="option.action" [disabled]="facade.pendingAction() !== null" (click)="armed.set(option)">{{ option.label }}</button>
                    }
                  </div>
                }
                @if (facade.actionFailure(); as failure) {
                  <p class="failure" role="alert">{{ failure }}</p>
                }
              </section>
            }
          }
          @case ('transaction') {
            @if (item.decided; as decided) {
              <dl>
                <div><dt>Transaction</dt><dd class="mono">{{ item.transactionId }}</dd></div>
                <div><dt>Amount</dt><dd>{{ decided.amount | minorUnitsCurrency }}</dd></div>
                <div><dt>From → to</dt><dd>{{ decided.institutionId | institutionLabel }} → {{ decided.destinationInstitutionId | institutionLabel }}</dd></div>
                <div><dt>Account</dt><dd class="mono">{{ item.reference }}</dd></div>
                <div><dt>Account token</dt><dd class="mono">{{ item.accountId }}</dd></div>
                <div><dt>Policy decision</dt><dd [attr.data-decision]="decided.decision">{{ decided.decision }}</dd></div>
                <div><dt>Risk score</dt><dd [attr.data-band]="decided.band">{{ decided.score }} ({{ decided.band }})</dd></div>
                <div><dt>24h drain</dt><dd>{{ decided.drainPct | number: '1.0-1' }}%</dd></div>
                <div><dt>Policy</dt><dd>{{ decided.policyVersion }} · {{ decided.rulesetVersion }}</dd></div>
              </dl>
            } @else {
              <p class="empty">This transfer is no longer on the live tape; its intervention records remain in the audit trail.</p>
            }
          }
          @case ('audit') {
            <ol class="audit">
              @for (record of item.history; track record.id) {
                <li [attr.data-state]="record.state">
                  <span class="when mono">{{ record.actedAt | date: 'd MMM, HH:mm:ss' : 'UTC' }}</span>
                  <b>{{ record.previousState }} → {{ record.state }}</b>
                  <span class="who">{{ record.actor.toLowerCase() }}{{ record.actorIdentity ? ' · ' + record.actorIdentity : '' }}</span>
                  <span class="why">{{ record.reasonCodes.join(', ') }}</span>
                </li>
              }
            </ol>
          }
        }
      </div>
      <div class="quick">
        <button type="button" [disabled]="!facade.selectedHasCase()" [attr.title]="facade.selectedHasCase() ? null : 'Network Analysis opens on an open case; this account has none'" (click)="facade.openNetwork(item)">
          <sentinel-icon name="network" [size]="18" /> Network Analysis
        </button>
        <button type="button" (click)="facade.openTransaction(item)"><sentinel-icon name="activity" [size]="18" /> View transaction</button>
        <button type="button" (click)="facade.openInvestigation(item)"><sentinel-icon name="investigate" [size]="18" /> Open investigation</button>
      </div>
    } @else {
      <div class="placeholder">
        <sentinel-icon name="intervention" [size]="28" />
        <p>Select an intervention to see its details, transaction and audit trail.</p>
      </div>
    }
  `,
  styleUrl: './intervention-detail.css',
})
export class InterventionDetail {
  protected readonly facade = inject(InterventionsFacade);
  protected readonly tab = signal<Tab>('overview');
  protected readonly armed = signal<(typeof ACTIONS)[number] | null>(null);
  protected readonly actions = ACTIONS;
  private readonly selectedId = computed(() => this.facade.selectedId());

  constructor() {
    // Another intervention starts on its overview, with nothing armed.
    effect(() => {
      void this.selectedId();
      this.tab.set('overview');
      this.armed.set(null);
    });
  }

  protected actorLabel(item: InterventionRow): string {
    const actor = item.actor === 'SYSTEM' ? 'Rule engine' : item.actor === 'CUSTOMER' ? 'Customer' : 'Analyst';
    return item.actorIdentity ? `${actor} · ${item.actorIdentity}` : actor;
  }

  protected record(item: InterventionRow, action: InterventionAction): void {
    this.facade.act(action, item.transactionId);
    this.armed.set(null);
  }
}
