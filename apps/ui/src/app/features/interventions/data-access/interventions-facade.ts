import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { INTERVENTION_REASON, type Decision, type Intervention, type InterventionActor, type InterventionState, type MinorUnits, type RiskBand } from '@sentinel/domain';
import type { Observable } from 'rxjs';
import { CoreApiClient } from '../../../core/http/api-client/core-api-client';
import { AlertsActions } from '../../../state/alerts/alerts.actions';
import { alertsFeature } from '../../../state/alerts/alerts.feature';
import { InterventionsActions } from '../../../state/interventions/interventions.actions';
import { interventionsFeature } from '../../../state/interventions/interventions.feature';
import { sessionFeature } from '../../../state/session/session.feature';
import { transactionsFeature } from '../../../state/transactions/transactions.feature';

/** How the hold began: the transfer breached the drain threshold itself, or the account was already held. */
export type InterventionKind = 'THRESHOLD' | 'CASCADE' | 'KILL_SWITCH';

/** The exceptions sentinel-core accepts around a policy hold. There is deliberately no analyst release. */
export type InterventionAction = 'customer-verified-release' | 'customer-cancellation' | 'fraud-confirmation';

/** One intervened transfer: its append-only record history, and the decision the gate recorded for it. */
export interface InterventionRow {
  readonly transactionId: string;
  /** The latest record's id. */
  readonly id: string;
  readonly kind: InterventionKind;
  readonly accountId: string;
  readonly reference: string;
  /** Current state: the latest record. A HOLD decision whose record is RELEASED stays a HOLD decision. */
  readonly state: InterventionState;
  readonly actor: InterventionActor;
  readonly actorIdentity: string | null;
  readonly heldAt: string;
  readonly updatedAt: string;
  readonly holdUntil: string | null;
  readonly reasonCodes: readonly string[];
  readonly cascadeOf: string | null;
  readonly history: readonly Intervention[];
  /** From the live tape, when the transfer is still on it; never inferred from the intervention. */
  readonly decided: {
    readonly decision: Decision;
    readonly score: number;
    readonly band: RiskBand;
    readonly amount: MinorUnits;
    readonly institutionId: string;
    readonly destinationInstitutionId: string;
    readonly policyVersion: string;
    readonly rulesetVersion: string;
    readonly drainPct: number;
  } | null;
}

export type SortKey = 'heldAt' | 'reference' | 'kind' | 'score' | 'amount' | 'state' | 'updatedAt';

export interface InterventionFilters {
  readonly query: string;
  readonly kind: 'ALL' | InterventionKind;
  readonly state: 'ALL' | InterventionState;
  readonly band: 'ALL' | 'HIGH' | 'ELEVATED' | 'LOW';
  readonly institution: string;
  readonly range: 'ALL' | '1H' | '24H' | '7D';
}

const DEFAULT_FILTERS: InterventionFilters = { query: '', kind: 'ALL', state: 'ALL', band: 'ALL', institution: 'ALL', range: 'ALL' };
const RANGE_MS = { '1H': 3_600_000, '24H': 86_400_000, '7D': 7 * 86_400_000 } as const;
const STATE_RANK: Readonly<Record<InterventionState, number>> = { HELD: 3, REJECTED: 2, CANCELLED: 1, RELEASED: 0 };

function failureMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return 'The action could not be recorded.';
  if (error.status === 0) return 'sentinel-core is unreachable; nothing was recorded.';
  if (error.status === 409) return 'This hold has already moved; the audit trail shows its current state.';
  return `sentinel-core refused the action (HTTP ${error.status}); nothing was recorded.`;
}

/**
 * The Interventions workspace (route-scoped): every policy hold sentinel-core has recorded, each with its
 * append-only history, joined to the gate's recorded decision for the transfer. Actions go to sentinel-core's
 * own exception routes and only change the page when the server's record comes back.
 */
@Injectable()
export class InterventionsFacade {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly core = inject(CoreApiClient);
  private readonly byTransactionId = this.store.selectSignal(interventionsFeature.selectByTransactionId);
  private readonly tape = this.store.selectSignal(transactionsFeature.selectTape);
  private readonly openAlerts = this.store.selectSignal(alertsFeature.selectOpenAlerts);
  readonly analystIdentity = this.store.selectSignal(sessionFeature.selectAnalystIdentity);

  readonly rows = computed<readonly InterventionRow[]>(() => {
    const tape = new Map(this.tape().map((row) => [row.transactionId, row]));
    return Object.entries(this.byTransactionId()).flatMap(([transactionId, records]) => {
      const history = [...records].sort((a, b) => a.actedAt.localeCompare(b.actedAt));
      const first = history[0];
      const latest = history[history.length - 1];
      if (!first || !latest) return [];
      const row = tape.get(transactionId);
      return [
        {
          transactionId,
          id: latest.id,
          kind: first.reasonCodes.includes(INTERVENTION_REASON.killSwitch) ? 'KILL_SWITCH' : first.cascadeOfTransactionId ? 'CASCADE' : 'THRESHOLD',
          accountId: latest.accountId,
          reference: row?.accountReference ?? latest.accountId,
          state: latest.state,
          actor: latest.actor,
          actorIdentity: latest.actorIdentity ?? null,
          heldAt: first.actedAt,
          updatedAt: latest.actedAt,
          holdUntil: first.holdUntil ?? null,
          reasonCodes: first.reasonCodes,
          cascadeOf: first.cascadeOfTransactionId ?? null,
          history,
          decided: row
            ? {
                decision: row.decision,
                score: row.score,
                band: row.band,
                amount: row.amount,
                institutionId: row.institutionId,
                destinationInstitutionId: row.destinationInstitutionId,
                policyVersion: row.policyVersion,
                rulesetVersion: row.rulesetVersion,
                drainPct: row.drain.drainPct,
              }
            : null,
        } satisfies InterventionRow,
      ];
    });
  });

  readonly kpis = computed(() => {
    const rows = this.rows();
    const count = (state: InterventionState) => rows.filter((row) => row.state === state).length;
    return {
      total: rows.length,
      records: rows.reduce((sum, row) => sum + row.history.length, 0),
      held: count('HELD'),
      released: count('RELEASED'),
      closed: count('REJECTED') + count('CANCELLED'),
      rejected: count('REJECTED'),
      cancelled: count('CANCELLED'),
    };
  });
  readonly institutions = computed(() => [...new Set(this.rows().flatMap((row) => (row.decided ? [row.decided.institutionId] : [])))].sort());

  readonly filters = signal<InterventionFilters>(DEFAULT_FILTERS);
  readonly sort = signal<{ readonly key: SortKey; readonly direction: 'asc' | 'desc' }>({ key: 'heldAt', direction: 'desc' });
  readonly page = signal(1);
  readonly pageSize = signal(10);

  readonly filtered = computed<readonly InterventionRow[]>(() => {
    const filters = this.filters();
    const query = filters.query.trim().toLowerCase();
    const now = Date.now();
    const rows = this.rows().filter(
      (row) =>
        (!query || [row.reference, row.accountId, row.transactionId, row.id].some((value) => value.toLowerCase().includes(query))) &&
        (filters.kind === 'ALL' || row.kind === filters.kind) &&
        (filters.state === 'ALL' || row.state === filters.state) &&
        (filters.band === 'ALL' ||
          (row.decided !== null && (filters.band === 'HIGH' ? row.decided.band === 'HIGH' || row.decided.band === 'CRITICAL' : row.decided.band === filters.band))) &&
        (filters.institution === 'ALL' || row.decided?.institutionId === filters.institution) &&
        (filters.range === 'ALL' || now - Date.parse(row.heldAt) <= RANGE_MS[filters.range]),
    );
    const { key, direction } = this.sort();
    const sign = direction === 'asc' ? 1 : -1;
    const value = (row: InterventionRow): string | number =>
      key === 'score' ? (row.decided?.score ?? -1) : key === 'amount' ? (row.decided?.amount ?? -1) : key === 'state' ? STATE_RANK[row.state] : row[key];
    return [...rows].sort((left, right) => {
      const a = value(left);
      const b = value(right);
      const order = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b));
      return order * sign || right.heldAt.localeCompare(left.heldAt);
    });
  });
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize())));
  readonly visible = computed(() => {
    const page = Math.min(this.page(), this.pageCount());
    return this.filtered().slice((page - 1) * this.pageSize(), page * this.pageSize());
  });
  readonly isFiltered = computed(() => JSON.stringify(this.filters()) !== JSON.stringify(DEFAULT_FILTERS));

  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(() => this.rows().find((row) => row.transactionId === this.selectedId()) ?? null);
  readonly selectedHasCase = computed(() => {
    const row = this.selected();
    return row ? this.openAlerts().some((alert) => alert.accountId === row.accountId) : false;
  });

  private readonly pendingState = signal<InterventionAction | null>(null);
  private readonly failureState = signal<{ readonly transactionId: string; readonly message: string } | null>(null);
  readonly pendingAction = this.pendingState.asReadonly();
  readonly actionFailure = computed(() => {
    const failure = this.failureState();
    return failure && failure.transactionId === this.selectedId() ? failure.message : null;
  });

  setFilter<K extends keyof InterventionFilters>(key: K, value: InterventionFilters[K]): void {
    this.filters.update((filters) => ({ ...filters, [key]: value }));
    this.page.set(1);
  }

  clearFilters(): void {
    this.filters.set(DEFAULT_FILTERS);
    this.page.set(1);
  }

  sortBy(key: SortKey): void {
    this.sort.update((sort) => (sort.key === key ? { key, direction: sort.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: key === 'reference' || key === 'kind' ? 'asc' : 'desc' }));
    this.page.set(1);
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
  }

  select(transactionId: string | null): void {
    this.selectedId.set(transactionId);
  }

  /**
   * Records an exception on sentinel-core. The page changes only when the server's record arrives (and again,
   * deduplicated, from the stream); a refusal leaves everything as it was and says why.
   */
  act(action: InterventionAction, transactionId: string): void {
    const identity = this.analystIdentity();
    const path = `/v1/interventions/${encodeURIComponent(transactionId)}/${action}`;
    const request: Observable<Intervention> | null =
      action === 'fraud-confirmation' ? (identity ? this.core.post<Intervention>(path, { analystIdentity: identity }) : null) : this.core.post<Intervention>(path, {});
    if (!request) {
      this.failureState.set({ transactionId, message: 'Confirming fraud needs a signed-in analyst identity.' });
      return;
    }
    this.pendingState.set(action);
    this.failureState.set(null);
    request.subscribe({
      next: (intervention) => {
        this.store.dispatch(InterventionsActions.interventionAppended({ intervention }));
        this.pendingState.set(null);
      },
      error: (error: unknown) => {
        this.failureState.set({ transactionId, message: failureMessage(error) });
        this.pendingState.set(null);
      },
    });
  }

  openInvestigation(row: InterventionRow): void {
    this.store.dispatch(AlertsActions.accountSelected({ accountId: row.accountId }));
    void this.router.navigateByUrl('/investigations');
  }

  openNetwork(row: InterventionRow): void {
    this.store.dispatch(AlertsActions.accountSelected({ accountId: row.accountId }));
    void this.router.navigateByUrl('/network-analysis');
  }

  openTransaction(row: InterventionRow): void {
    void this.router.navigate(['/live-transactions'], { queryParams: { txn: row.transactionId } });
  }
}
