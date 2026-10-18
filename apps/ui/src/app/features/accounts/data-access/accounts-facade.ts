import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import type { Alert, Decision, EvidenceBundle, InterventionState, InvestigationEvidence, MinorUnits, RiskBand } from '@sentinel/domain';
import { CoreApiClient } from '../../../core/http/api-client/core-api-client';
import { AlertsActions } from '../../../state/alerts/alerts.actions';
import { alertsFeature } from '../../../state/alerts/alerts.feature';
import { interventionsFeature } from '../../../state/interventions/interventions.feature';
import { transactionsFeature } from '../../../state/transactions/transactions.feature';
import type { TapeRow } from '../../../workers/transaction-worker-protocol';

/** The account's current state, separate from its risk band and its latest policy decision. */
export type AccountStatus = 'ON HOLD' | 'REJECTED' | 'RELEASED' | 'ALERT OPEN' | 'MONITORED';

/** One monitored account, from its latest decision on the stream; every figure is the core's own. */
export interface AccountRow {
  readonly accountId: string;
  readonly reference: string;
  readonly institutionId: string;
  readonly score: number;
  readonly band: RiskBand;
  readonly decision: Decision;
  readonly status: AccountStatus;
  /** The latest intervention state on any of the account's transfers, when one was recorded. */
  readonly intervention: InterventionState | null;
  readonly openAlert: Alert | null;
  readonly lastActivity: string;
  readonly latestTransactionId: string;
  readonly assessmentId: string;
  /** The rolling 24-hour window the drain gate measures: opening balance and outflow since. */
  readonly windowBalance: MinorUnits;
  readonly outflow24h: MinorUnits;
  readonly drainPct: number;
}

export type SortKey = 'reference' | 'institutionId' | 'windowBalance' | 'outflow24h' | 'score' | 'decision' | 'status' | 'lastActivity';
export type ActivityRange = 'ALL' | '1H' | '24H' | '7D';

export interface AccountFilters {
  readonly query: string;
  readonly institution: string;
  readonly band: 'ALL' | 'HIGH' | 'ELEVATED' | 'LOW';
  readonly decision: 'ALL' | Decision;
  readonly status: 'ALL' | AccountStatus;
  readonly activity: ActivityRange;
}

const DEFAULT_FILTERS: AccountFilters = { query: '', institution: 'ALL', band: 'ALL', decision: 'ALL', status: 'ALL', activity: 'ALL' };
const RANGE_MS: Readonly<Record<Exclude<ActivityRange, 'ALL'>, number>> = { '1H': 3_600_000, '24H': 86_400_000, '7D': 7 * 86_400_000 };
const STATUS_RANK: Readonly<Record<AccountStatus, number>> = { 'ON HOLD': 4, REJECTED: 3, 'ALERT OPEN': 2, RELEASED: 1, MONITORED: 0 };

export const isHighRisk = (band: RiskBand): boolean => band === 'HIGH' || band === 'CRITICAL';

/**
 * The Accounts directory (route-scoped). There is no account listing API: the directory is every account the
 * live stream has scored, from its latest decision record, joined to open alerts and intervention records.
 * Selecting an account loads that account's evidence bundle; a newer selection always wins over a slower reply.
 */
@Injectable()
export class AccountsFacade {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly core = inject(CoreApiClient);
  private readonly latestByAccount = this.store.selectSignal(transactionsFeature.selectLatestByAccount);
  private readonly tape = this.store.selectSignal(transactionsFeature.selectTape);
  private readonly openAlerts = this.store.selectSignal(alertsFeature.selectOpenAlerts);
  private readonly latestInterventions = this.store.selectSignal(interventionsFeature.selectLatestByTransaction);

  readonly accounts = computed<readonly AccountRow[]>(() => {
    const alerts = new Map(this.openAlerts().map((alert) => [alert.accountId, alert]));
    const interventions = new Map<string, { state: InterventionState; at: string }>();
    for (const intervention of this.latestInterventions()) {
      const known = interventions.get(intervention.accountId);
      if (!known || intervention.actedAt > known.at) interventions.set(intervention.accountId, { state: intervention.state, at: intervention.actedAt });
    }
    return Object.values(this.latestByAccount()).map((record) => {
      const intervention = interventions.get(record.accountId)?.state ?? null;
      const openAlert = alerts.get(record.accountId) ?? null;
      const status: AccountStatus =
        intervention === 'HELD' ? 'ON HOLD' : intervention === 'REJECTED' ? 'REJECTED' : openAlert ? 'ALERT OPEN' : intervention === 'RELEASED' ? 'RELEASED' : 'MONITORED';
      return {
        accountId: record.accountId,
        reference: record.accountReference ?? record.accountId,
        institutionId: record.institutionId,
        score: record.assessment.score,
        band: record.band,
        decision: record.decision,
        status,
        intervention,
        openAlert,
        lastActivity: record.occurredAt,
        latestTransactionId: record.transactionId,
        assessmentId: record.assessmentId,
        windowBalance: record.assessment.drain.balanceAtWindowStart,
        outflow24h: record.assessment.drain.outflow24h,
        drainPct: record.assessment.drain.drainPct,
      };
    });
  });

  readonly kpis = computed(() => {
    const rows = this.accounts();
    const highRisk = rows.filter((row) => isHighRisk(row.band)).length;
    const review = rows.filter((row) => row.openAlert !== null).length;
    const onHold = rows.filter((row) => row.status === 'ON HOLD').length;
    const normal = rows.filter((row) => !isHighRisk(row.band) && row.openAlert === null && row.status !== 'ON HOLD' && row.status !== 'REJECTED').length;
    return { total: rows.length, highRisk, review, onHold, normal };
  });
  readonly institutions = computed(() => [...new Set(this.accounts().map((row) => row.institutionId))].sort());

  readonly filters = signal<AccountFilters>(DEFAULT_FILTERS);
  readonly sort = signal<{ readonly key: SortKey; readonly direction: 'asc' | 'desc' }>({ key: 'score', direction: 'desc' });
  readonly page = signal(1);
  readonly pageSize = signal(8);

  readonly filtered = computed<readonly AccountRow[]>(() => {
    const filters = this.filters();
    const query = filters.query.trim().toLowerCase();
    const now = Date.now();
    const rows = this.accounts().filter(
      (row) =>
        (!query || row.reference.toLowerCase().includes(query) || row.accountId.toLowerCase().includes(query)) &&
        (filters.institution === 'ALL' || row.institutionId === filters.institution) &&
        (filters.band === 'ALL' || (filters.band === 'HIGH' ? isHighRisk(row.band) : row.band === filters.band)) &&
        (filters.decision === 'ALL' || row.decision === filters.decision) &&
        (filters.status === 'ALL' || row.status === filters.status) &&
        (filters.activity === 'ALL' || now - Date.parse(row.lastActivity) <= RANGE_MS[filters.activity]),
    );
    const { key, direction } = this.sort();
    const sign = direction === 'asc' ? 1 : -1;
    const value = (row: AccountRow): string | number => (key === 'status' ? STATUS_RANK[row.status] : row[key]);
    return [...rows].sort((left, right) => {
      const a = value(left);
      const b = value(right);
      const order = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b));
      return order * sign || right.lastActivity.localeCompare(left.lastActivity);
    });
  });
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize())));
  readonly visible = computed(() => {
    const page = Math.min(this.page(), this.pageCount());
    const size = this.pageSize();
    return this.filtered().slice((page - 1) * size, page * size);
  });
  readonly isFiltered = computed(() => JSON.stringify(this.filters()) !== JSON.stringify(DEFAULT_FILTERS));

  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(() => this.accounts().find((row) => row.accountId === this.selectedId()) ?? null);
  /** The selected account's recent decisions on the live tape, newest first. */
  readonly recentActivity = computed<readonly TapeRow[]>(() => {
    const id = this.selectedId();
    return id ? this.tape().filter((row) => row.accountId === id).slice(0, 6) : [];
  });

  private readonly evidenceState = signal<{ readonly accountId: string | null; readonly status: 'IDLE' | 'LOADING' | 'READY' | 'FAILED'; readonly evidence: EvidenceBundle | null }>({
    accountId: null,
    status: 'IDLE',
    evidence: null,
  });
  /** Evidence only ever for the account now selected: a previous account's bundle is never shown. */
  readonly evidence = computed(() => (this.evidenceState().accountId === this.selectedId() ? this.evidenceState().evidence : null));
  readonly evidenceStatus = computed(() => (this.evidenceState().accountId === this.selectedId() ? this.evidenceState().status : 'LOADING'));

  constructor() {
    effect(() => {
      const row = this.selected();
      const key = row ? `${row.accountId}|${row.assessmentId}` : null;
      untracked(() => this.load(row, key));
    });
  }

  setFilter<K extends keyof AccountFilters>(key: K, value: AccountFilters[K]): void {
    this.filters.update((filters) => ({ ...filters, [key]: value }));
    this.page.set(1);
  }

  clearFilters(): void {
    this.filters.set(DEFAULT_FILTERS);
    this.page.set(1);
  }

  sortBy(key: SortKey): void {
    this.sort.update((sort) => (sort.key === key ? { key, direction: sort.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: key === 'reference' || key === 'institutionId' ? 'asc' : 'desc' }));
    this.page.set(1);
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
  }

  select(accountId: string | null): void {
    this.selectedId.set(accountId);
  }

  /** CSV of every account matching the current search and filters, in the current order. */
  exportCsv(): string {
    const header = ['Account', 'Account token', 'Institution', 'Window opening balance (SGD)', '24h outflow (SGD)', 'Drain %', 'Risk score', 'Risk band', 'Latest decision', 'Status', 'Last activity (UTC)'];
    const cell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = this.filtered().map((row) =>
      [row.reference, row.accountId, row.institutionId, (row.windowBalance / 100).toFixed(2), (row.outflow24h / 100).toFixed(2), row.drainPct.toFixed(1), row.score, row.band, row.decision, row.status, row.lastActivity].map(cell).join(','),
    );
    return [header.map(cell).join(','), ...rows].join('\r\n');
  }

  openInvestigation(row: AccountRow): void {
    this.store.dispatch(AlertsActions.accountSelected({ accountId: row.accountId }));
    void this.router.navigateByUrl('/investigations');
  }

  /** Network Analysis opens on an alert case; the account must have one open. */
  openNetwork(row: AccountRow): void {
    if (!row.openAlert) return;
    this.store.dispatch(AlertsActions.accountSelected({ accountId: row.accountId }));
    void this.router.navigateByUrl('/network-analysis');
  }

  openTransactions(row: AccountRow): void {
    void this.router.navigate(['/live-transactions'], { queryParams: { txn: row.latestTransactionId } });
  }

  private load(row: AccountRow | null, key: string | null): void {
    if (!row || !key) {
      this.evidenceState.set({ accountId: null, status: 'IDLE', evidence: null });
      return;
    }
    const current = this.evidenceState();
    if (current.accountId === row.accountId && current.status !== 'FAILED' && this.loadedKey === key) return;
    this.loadedKey = key;
    this.evidenceState.set({ accountId: row.accountId, status: 'LOADING', evidence: null });
    this.core.get<InvestigationEvidence>(`/v1/investigations/${encodeURIComponent(row.assessmentId)}/evidence`).subscribe({
      next: ({ evidence }) => {
        if (this.selectedId() === row.accountId) this.evidenceState.set({ accountId: row.accountId, status: 'READY', evidence });
      },
      error: () => {
        if (this.selectedId() === row.accountId) this.evidenceState.set({ accountId: row.accountId, status: 'FAILED', evidence: null });
      },
    });
  }

  private loadedKey: string | null = null;
}
