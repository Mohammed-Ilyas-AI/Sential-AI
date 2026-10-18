import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import type { EvidenceBundle } from '@sentinel/domain';
import { InstitutionLabelPipe } from '../../../../shared/pipes/institution-label/institution-label-pipe';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import type { TapeRow } from '../../../../workers/transaction-worker-protocol';
import type { AccountRow } from '../../data-access/accounts-facade';

type Tab = 'overview' | 'transactions' | 'connections' | 'alerts';

/**
 * The selected account. Risk band, latest policy decision and current status are three separate facts; the
 * evidence tabs come from the bundle sentinel-core compiles for the account's latest assessment, and show a
 * loading or unavailable state of their own rather than another account's data.
 */
@Component({
  selector: 'sentinel-account-detail',
  imports: [DatePipe, DecimalPipe, Icon, InstitutionLabelPipe, MinorUnitsCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let item = row();
    <header>
      <div>
        <h2 class="mono">{{ item.reference }}</h2>
        <p class="caption mono">{{ item.accountId }}</p>
      </div>
      <button type="button" class="close" aria-label="Close account details" title="Close" (click)="closed.emit()"><sentinel-icon name="close" [size]="16" /></button>
    </header>
    <div class="status">
      <span class="chip" [attr.data-status]="item.status">{{ item.status }}</span>
      <span class="score">Risk score <b [attr.data-band]="item.band">{{ item.score }}</b> / 100</span>
    </div>
    <nav class="tabs" role="tablist" aria-label="Account details">
      <button type="button" role="tab" [attr.aria-selected]="tab() === 'overview'" (click)="tab.set('overview')">Overview</button>
      <button type="button" role="tab" [attr.aria-selected]="tab() === 'transactions'" (click)="tab.set('transactions')">Transactions{{ evidence() ? ' (' + evidence()!.recentTransactions.length + ')' : '' }}</button>
      <button type="button" role="tab" [attr.aria-selected]="tab() === 'connections'" (click)="tab.set('connections')">Connections{{ evidence() ? ' (' + connections().length + ')' : '' }}</button>
      <button type="button" role="tab" [attr.aria-selected]="tab() === 'alerts'" (click)="tab.set('alerts')">Alerts</button>
    </nav>
    <div class="body sentinel-scroll">
      @switch (tab()) {
        @case ('overview') {
          <h3>Account details</h3>
          <dl>
            <div><dt>Account</dt><dd class="mono">{{ item.reference }}</dd></div>
            <div><dt>Institution</dt><dd>{{ item.institutionId | institutionLabel }}</dd></div>
            @if (evidence(); as bundle) {
              <div><dt>Opened</dt><dd>{{ bundle.account.openedAt | date: 'd MMM y' : 'UTC' }}</dd></div>
              <div><dt>Protected account</dt><dd>{{ bundle.account.protected ? 'Yes' : 'No' }}</dd></div>
            }
            <div><dt>Window opening balance</dt><dd>{{ item.windowBalance | minorUnitsCurrency }}</dd></div>
            <div><dt>24h outflow</dt><dd>{{ item.outflow24h | minorUnitsCurrency }} ({{ item.drainPct | number: '1.0-1' }}%)</dd></div>
            <div><dt>Risk score</dt><dd [attr.data-band]="item.band">{{ item.score }} ({{ item.band }})</dd></div>
            <div><dt>Latest decision</dt><dd [attr.data-decision]="item.decision">{{ item.decision }}</dd></div>
            <div><dt>Current status</dt><dd>{{ item.status }}{{ item.intervention ? ' · intervention ' + item.intervention : '' }}</dd></div>
            <div><dt>Last activity</dt><dd>{{ item.lastActivity | date: 'd MMM y, HH:mm:ss' : 'UTC' }} UTC</dd></div>
          </dl>
          <h3>Recent activity</h3>
          <ul class="activity">
            @for (decision of activity(); track decision.transactionId) {
              <li>
                <span class="dot" [attr.data-decision]="decision.decision"></span>
                <span class="mono when">{{ decision.occurredAt | date: 'd MMM, HH:mm:ss' : 'UTC' }}</span>
                <b>{{ decision.amount | minorUnitsCurrency }}</b>
                <span class="tag" [attr.data-decision]="decision.decision">{{ decision.decision }}</span>
              </li>
            } @empty {
              <li class="empty">No decisions for this account on the live tape.</li>
            }
          </ul>
        }
        @case ('transactions') {
          @if (evidence(); as bundle) {
            <ul class="list">
              @for (transaction of bundle.recentTransactions; track transaction.id) {
                <li>
                  <span class="mono id">{{ transaction.id }}</span>
                  <span class="line"><b>{{ transaction.amount | minorUnitsCurrency }}</b> → {{ transaction.destInstitutionId | institutionLabel }} · {{ transaction.ts | date: 'd MMM, HH:mm' : 'UTC' }}</span>
                  <span class="line mono">{{ transaction.channel }} · payee {{ transaction.payeeId }}</span>
                </li>
              } @empty {
                <li class="empty">No transfers in the evidence.</li>
              }
            </ul>
          } @else {
            <p class="empty">{{ unavailable() }}</p>
          }
        }
        @case ('connections') {
          @if (evidence()) {
            <ul class="list">
              @for (connection of connections(); track connection.id) {
                <li>
                  <span class="line"><b>{{ connection.kind }}</b> · {{ connection.detail }}</span>
                  <span class="mono id">{{ connection.id }}</span>
                </li>
              } @empty {
                <li class="empty">No related entities in the evidence.</li>
              }
            </ul>
          } @else {
            <p class="empty">{{ unavailable() }}</p>
          }
        }
        @case ('alerts') {
          <ul class="list">
            @if (item.openAlert; as alert) {
              <li>
                <span class="line"><b>Open alert</b> · score {{ alert.score }} ({{ alert.band }})</span>
                <span class="line">Raised {{ alert.raisedAt | date: 'd MMM y, HH:mm' : 'UTC' }} UTC</span>
              </li>
            }
            @for (prior of evidence()?.priorAlerts ?? []; track prior.alertId) {
              <li>
                <span class="line"><b>Prior alert</b> · score {{ prior.score }} ({{ prior.band }})</span>
                <span class="line">Raised {{ prior.raisedAt | date: 'd MMM y, HH:mm' : 'UTC' }} UTC</span>
              </li>
            }
            @if (!item.openAlert && (evidence()?.priorAlerts?.length ?? 0) === 0) {
              <li class="empty">{{ evidence() ? 'No alerts for this account.' : unavailable() }}</li>
            }
          </ul>
        }
      }
    </div>
    <div class="actions">
      <button type="button" [disabled]="!item.openAlert" [attr.title]="item.openAlert ? null : 'Network Analysis opens on an open case; this account has none'" (click)="network.emit()">
        <sentinel-icon name="network" [size]="16" /> Network
      </button>
      <button type="button" (click)="transactions.emit()"><sentinel-icon name="activity" [size]="16" /> Transactions</button>
    </div>
    <button type="button" class="primary" (click)="investigation.emit()">Open in investigation <sentinel-icon name="arrowRight" [size]="16" /></button>
  `,
  styleUrl: './account-detail.css',
})
export class AccountDetail {
  readonly row = input.required<AccountRow>();
  readonly evidence = input<EvidenceBundle | null>(null);
  readonly evidenceStatus = input<'IDLE' | 'LOADING' | 'READY' | 'FAILED'>('IDLE');
  readonly activity = input<readonly TapeRow[]>([]);
  readonly closed = output<void>();
  readonly network = output<void>();
  readonly transactions = output<void>();
  readonly investigation = output<void>();

  protected readonly tab = signal<Tab>('overview');
  protected readonly unavailable = computed(() =>
    this.evidenceStatus() === 'FAILED' ? 'The evidence for this account could not be loaded.' : 'Loading the account evidence…',
  );

  /** Destination accounts, payees and devices the account's own transfers and events record. */
  protected readonly connections = computed(() => {
    const evidence = this.evidence();
    if (!evidence) return [];
    const seen = new Map<string, { id: string; kind: string; detail: string }>();
    for (const transaction of evidence.recentTransactions) {
      if (!seen.has(transaction.destAccountId)) seen.set(transaction.destAccountId, { id: transaction.destAccountId, kind: 'Account', detail: `received transfers at ${transaction.destInstitutionId.replace('BANK_', 'Bank ')}` });
      if (transaction.payeeId && !seen.has(transaction.payeeId)) seen.set(transaction.payeeId, { id: transaction.payeeId, kind: 'Beneficiary', detail: 'payee used for transfers' });
      if (transaction.deviceId && !seen.has(transaction.deviceId)) seen.set(transaction.deviceId, { id: transaction.deviceId, kind: 'Device', detail: 'device used for transfers' });
    }
    for (const event of evidence.deviceHistory) if (!seen.has(event.deviceId)) seen.set(event.deviceId, { id: event.deviceId, kind: 'Device', detail: event.eventType.replaceAll('_', ' ').toLowerCase() });
    for (const event of evidence.payeeHistory) if (!seen.has(event.payeeId)) seen.set(event.payeeId, { id: event.payeeId, kind: 'Beneficiary', detail: 'payee added' });
    for (const node of evidence.neighbourhood.nodes) if (!seen.has(node.id)) seen.set(node.id, { id: node.id, kind: node.kind.charAt(0) + node.kind.slice(1).toLowerCase(), detail: 'network neighbourhood' });
    return [...seen.values()];
  });

  constructor() {
    // Another account starts on its overview.
    effect(() => {
      void this.row().accountId;
      this.tab.set('overview');
    });
  }
}
