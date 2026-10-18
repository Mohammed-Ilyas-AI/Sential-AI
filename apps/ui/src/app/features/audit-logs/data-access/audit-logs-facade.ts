import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { interval, map } from 'rxjs';
import { AlertsActions } from '../../../state/alerts/alerts.actions';
import { alertsFeature } from '../../../state/alerts/alerts.feature';
import { interventionsFeature } from '../../../state/interventions/interventions.feature';
import { transactionsFeature } from '../../../state/transactions/transactions.feature';

export type AuditCategory = 'DECISION' | 'INTERVENTION' | 'ALERT';
export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AuditActorKind = 'POLICY_ENGINE' | 'SYSTEM' | 'CUSTOMER' | 'ANALYST';
export type AuditModule = 'Policy gate' | 'Interventions' | 'Alerts & cases';

export interface AuditFact {
  readonly label: string;
  readonly value: string;
}

/** One recorded event, read as stored: nothing here is derived beyond choosing which recorded field to show. */
export interface AuditEvent {
  readonly id: string;
  readonly at: string;
  readonly category: AuditCategory;
  readonly action: string;
  readonly actorKind: AuditActorKind;
  readonly actor: string;
  readonly module: AuditModule;
  readonly resource: string;
  readonly details: string;
  readonly result: string;
  readonly severity: AuditSeverity;
  readonly accountId: string;
  readonly transactionId: string;
  readonly institutionId: string | null;
  readonly facts: readonly AuditFact[];
}

export type AuditSortKey = 'at' | 'action' | 'actor' | 'module' | 'severity';
export type AuditZone = 'UTC' | 'SGT';

export interface AuditFilters {
  readonly query: string;
  readonly category: 'ALL' | AuditCategory;
  readonly actor: 'ALL' | AuditActorKind;
  readonly severity: 'ALL' | AuditSeverity;
  readonly module: 'ALL' | AuditModule;
  readonly range: 'ALL' | '1H' | '24H' | '7D';
}

const DEFAULT_FILTERS: AuditFilters = { query: '', category: 'ALL', actor: 'ALL', severity: 'ALL', module: 'ALL', range: 'ALL' };
const RANGE_MS = { '1H': 3_600_000, '24H': 86_400_000, '7D': 7 * 86_400_000 } as const;
const SEVERITY_RANK: Readonly<Record<AuditSeverity, number>> = { CRITICAL: 2, WARNING: 1, INFO: 0 };
export const AUDIT_PAGE_SIZE = 25;
const ACTOR_LABEL: Readonly<Record<'SYSTEM' | 'CUSTOMER' | 'ANALYST', string>> = { SYSTEM: 'System', CUSTOMER: 'Customer', ANALYST: 'Analyst' };

/**
 * Audit Logs (route-scoped): the decision, intervention and alert records this browser session holds, merged
 * into one read-only trail. Records are never edited here; the page only filters, sorts and exports what is
 * already recorded. Decisions come from the live tape (its last 200), interventions from their append-only
 * history, alerts from the open queue.
 */
@Injectable()
export class AuditLogsFacade {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly tape = this.store.selectSignal(transactionsFeature.selectTape);
  private readonly interventions = this.store.selectSignal(interventionsFeature.selectAllInterventions);
  private readonly alerts = this.store.selectSignal(alertsFeature.selectOpenAlerts);

  readonly filters = signal<AuditFilters>({
    ...DEFAULT_FILTERS,
    query: inject(ActivatedRoute).snapshot.queryParamMap.get('q') ?? '',
  });
  readonly sort = signal<{ key: AuditSortKey; direction: 'asc' | 'desc' }>({ key: 'at', direction: 'desc' });
  readonly page = signal(0);
  readonly zone = signal<AuditZone>('UTC');
  readonly selectedId = signal<string | null>(null);
  /** Read once per minute so a "last hour" range moves on without a new event. */
  private readonly now = toSignal(interval(60_000).pipe(map(() => Date.now())), { initialValue: Date.now() });

  readonly events = computed<readonly AuditEvent[]>(() => {
    const decisions = this.tape().map<AuditEvent>((row) => ({
      id: `decision:${row.assessmentId}`,
      at: row.decidedAt,
      category: 'DECISION',
      action: `Decision ${row.decision}`,
      actorKind: 'POLICY_ENGINE',
      actor: 'Policy gate',
      module: 'Policy gate',
      resource: row.accountReference ?? row.accountId,
      details: `Score ${row.score} (${row.band}) · ${row.reasonCodes.join(', ') || 'no reason codes'}`,
      result: row.decision,
      severity: row.decision === 'REJECT' ? 'CRITICAL' : row.decision === 'HOLD' ? 'WARNING' : 'INFO',
      accountId: row.accountId,
      transactionId: row.transactionId,
      institutionId: row.institutionId,
      facts: [
        { label: 'Assessment', value: row.assessmentId },
        { label: 'Transaction', value: row.transactionId },
        { label: 'Route', value: `${row.institutionId} → ${row.destinationInstitutionId}` },
        { label: 'Amount (SGD)', value: (row.amount / 100).toFixed(2) },
        { label: 'Occurred at', value: row.occurredAt },
        { label: 'Policy / ruleset', value: `${row.policyVersion} / ${row.rulesetVersion}` },
        ...(row.holdUntil ? [{ label: 'Hold until', value: row.holdUntil }] : []),
        ...(row.cascadeOfTransactionId ? [{ label: 'Cascade of', value: row.cascadeOfTransactionId }] : []),
      ],
    }));
    const references = new Map(this.tape().map((row) => [row.accountId, row.accountReference ?? row.accountId]));
    const institutions = new Map(this.tape().map((row) => [row.transactionId, row.institutionId]));
    const interventions = this.interventions().map<AuditEvent>((record) => ({
      id: `intervention:${record.id}`,
      at: record.actedAt,
      category: 'INTERVENTION',
      action: record.previousState === record.state ? `Intervention ${record.state}` : `${record.previousState} → ${record.state}`,
      actorKind: record.actor,
      actor: record.actorIdentity ?? ACTOR_LABEL[record.actor],
      module: 'Interventions',
      resource: references.get(record.accountId) ?? record.accountId,
      details: record.reasonCodes.join(', ') || 'no reason codes',
      result: record.state,
      severity: record.state === 'REJECTED' ? 'CRITICAL' : record.state === 'HELD' ? 'WARNING' : 'INFO',
      accountId: record.accountId,
      transactionId: record.transactionId,
      institutionId: institutions.get(record.transactionId) ?? null,
      facts: [
        { label: 'Record', value: record.id },
        { label: 'Decision', value: record.decisionId },
        { label: 'Transaction', value: record.transactionId },
        { label: 'Transition', value: `${record.previousState} → ${record.state}` },
        { label: 'Policy / ruleset', value: `${record.policyVersion} / ${record.rulesetVersion}` },
        ...(record.holdUntil ? [{ label: 'Hold until', value: record.holdUntil }] : []),
        ...(record.cascadeOfTransactionId ? [{ label: 'Cascade of', value: record.cascadeOfTransactionId }] : []),
      ],
    }));
    const alerts = this.alerts().map<AuditEvent>((alert) => ({
      id: `alert:${alert.id}`,
      at: alert.raisedAt,
      category: 'ALERT',
      action: 'Alert raised',
      actorKind: 'SYSTEM',
      actor: 'Risk engine',
      module: 'Alerts & cases',
      resource: alert.accountReference ?? alert.accountId,
      details: `Score ${alert.score} (${alert.band})${alert.onHold ? ' · account on hold' : ''}`,
      result: alert.status,
      severity: alert.band === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
      accountId: alert.accountId,
      transactionId: alert.transactionId,
      institutionId: institutions.get(alert.transactionId) ?? null,
      facts: [
        { label: 'Alert', value: alert.id },
        { label: 'Assessment', value: alert.assessmentId },
        { label: 'Transaction', value: alert.transactionId },
        { label: 'Status', value: alert.status },
        { label: 'Last updated', value: alert.updatedAt },
      ],
    }));
    return [...decisions, ...interventions, ...alerts];
  });

  readonly filtered = computed(() => {
    const { query, category, actor, severity, module, range } = this.filters();
    const needle = query.trim().toLowerCase();
    const since = range === 'ALL' ? null : this.now() - RANGE_MS[range];
    const { key, direction } = this.sort();
    const sign = direction === 'asc' ? 1 : -1;
    return this.events()
      .filter(
        (event) =>
          (category === 'ALL' || event.category === category) &&
          (actor === 'ALL' || event.actorKind === actor) &&
          (severity === 'ALL' || event.severity === severity) &&
          (module === 'ALL' || event.module === module) &&
          (since === null || Date.parse(event.at) >= since) &&
          (!needle ||
            [event.action, event.actor, event.resource, event.details, event.accountId, event.transactionId, event.institutionId ?? '', event.id].some((value) =>
              value.toLowerCase().includes(needle),
            )),
      )
      .sort((a, b) => {
        const primary =
          key === 'at'
            ? a.at.localeCompare(b.at)
            : key === 'severity'
              ? SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
              : a[key].localeCompare(b[key]);
        // Ties keep recorded order: newest first, then id, so paging is stable.
        return sign * primary || b.at.localeCompare(a.at) || a.id.localeCompare(b.id);
      });
  });

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / AUDIT_PAGE_SIZE)));
  readonly visible = computed(() => {
    const page = Math.min(this.page(), this.pageCount() - 1);
    return this.filtered().slice(page * AUDIT_PAGE_SIZE, (page + 1) * AUDIT_PAGE_SIZE);
  });
  readonly currentPage = computed(() => Math.min(this.page(), this.pageCount() - 1));

  readonly kpis = computed(() => {
    const events = this.events();
    return {
      total: events.length,
      analyst: events.filter((event) => event.actorKind === 'ANALYST' || event.actorKind === 'CUSTOMER').length,
      interventions: events.filter((event) => event.category === 'INTERVENTION').length,
      critical: events.filter((event) => event.severity === 'CRITICAL').length,
      warning: events.filter((event) => event.severity === 'WARNING').length,
    };
  });

  readonly selected = computed(() => this.events().find((event) => event.id === this.selectedId()) ?? null);

  setFilter<K extends keyof AuditFilters>(key: K, value: AuditFilters[K]): void {
    this.filters.update((filters) => ({ ...filters, [key]: value }));
    this.page.set(0);
  }

  resetFilters(): void {
    this.filters.set(DEFAULT_FILTERS);
    this.page.set(0);
  }

  sortBy(key: AuditSortKey): void {
    this.sort.update((sort) => (sort.key === key ? { key, direction: sort.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: key === 'at' || key === 'severity' ? 'desc' : 'asc' }));
    this.page.set(0);
  }

  /** The filtered trail as CSV, timestamps exactly as recorded (UTC ISO 8601). */
  exportCsv(): string {
    const header = ['Recorded at (UTC)', 'Category', 'Action', 'Actor', 'Module', 'Resource', 'Details', 'Result', 'Severity', 'Transaction', 'Event id'];
    const cell = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = this.filtered().map((event) =>
      [event.at, event.category, event.action, event.actor, event.module, event.resource, event.details, event.result, event.severity, event.transactionId, event.id].map(cell).join(','),
    );
    return [header.map(cell).join(','), ...rows].join('\r\n');
  }

  openInvestigation(event: AuditEvent): void {
    this.store.dispatch(AlertsActions.accountSelected({ accountId: event.accountId }));
    void this.router.navigateByUrl('/investigations');
  }

  openTransaction(event: AuditEvent): void {
    void this.router.navigate(['/live-transactions'], { queryParams: { txn: event.transactionId } });
  }

  openIntervention(): void {
    void this.router.navigateByUrl('/interventions');
  }
}

export const AUDIT_ZONE_OFFSET: Readonly<Record<AuditZone, string>> = { UTC: '+0000', SGT: '+0800' };
