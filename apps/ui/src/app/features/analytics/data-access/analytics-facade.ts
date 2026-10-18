import { Injectable, computed, inject, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { RULE_LABELS, TRANSACTION_TAPE_MAX_ROWS, type RiskBand, type RiskRuleCode } from '@sentinel/domain';
import { alertsFeature } from '../../../state/alerts/alerts.feature';
import { interventionsFeature } from '../../../state/interventions/interventions.feature';
import { transactionsFeature } from '../../../state/transactions/transactions.feature';
import type { TapeRow } from '../../../workers/transaction-worker-protocol';

export type Range = 'ALL' | '1H' | '24H' | '7D';
const RANGE_MS = { '1H': 3_600_000, '24H': 86_400_000, '7D': 7 * 86_400_000 } as const;
const BUCKETS = 24;
const BANDS: readonly RiskBand[] = ['LOW', 'ELEVATED', 'HIGH', 'CRITICAL'];

export interface VolumeBucket {
  readonly start: string;
  readonly counts: Readonly<Record<RiskBand, number>>;
  readonly total: number;
}

export interface ReportDefinition {
  readonly id: 'decisions' | 'high-risk' | 'interventions' | 'accounts';
  readonly title: string;
  readonly description: string;
  readonly rows: number;
}

const institution = (id: string) => {
  const synthetic = /^BANK_([A-Z])$/.exec(id);
  return synthetic ? `Bank ${synthetic[1]}` : id;
};

/**
 * Analytics & Reports (route-scoped). Everything is computed in the browser from what the live stream has
 * delivered: up to the latest decisions on the tape, the accounts' latest assessments, open alerts and the
 * intervention records. Reports are CSV extracts of exactly those records; nothing is projected or sampled.
 */
@Injectable()
export class AnalyticsFacade {
  private readonly store = inject(Store);
  private readonly tape = this.store.selectSignal(transactionsFeature.selectTape);
  private readonly latestByAccount = this.store.selectSignal(transactionsFeature.selectLatestByAccount);
  private readonly openAlerts = this.store.selectSignal(alertsFeature.selectOpenAlerts);
  private readonly interventions = this.store.selectSignal(interventionsFeature.selectLatestByTransaction);

  readonly tapeCapacity = TRANSACTION_TAPE_MAX_ROWS;
  readonly range = signal<Range>('ALL');
  readonly bank = signal<string>('ALL');
  readonly banks = computed(() => [...new Set(this.tape().map((row) => row.institutionId))].sort());

  readonly rows = computed<readonly TapeRow[]>(() => {
    const range = this.range();
    const bank = this.bank();
    const now = Date.now();
    return this.tape().filter(
      (row) => (bank === 'ALL' || row.institutionId === bank) && (range === 'ALL' || now - Date.parse(row.occurredAt) <= RANGE_MS[range]),
    );
  });

  readonly kpis = computed(() => {
    const rows = this.rows();
    const ids = new Set(rows.map((row) => row.transactionId));
    return {
      transactions: rows.length,
      value: rows.reduce((sum, row) => sum + row.amount, 0),
      highRisk: rows.filter((row) => row.band === 'HIGH' || row.band === 'CRITICAL').length,
      holds: rows.filter((row) => row.decision !== 'ALLOW').length,
      interventions: this.interventions().filter((intervention) => ids.has(intervention.transactionId)).length,
      accounts: new Set(rows.map((row) => row.accountId)).size,
      openAlerts: this.openAlerts().length,
    };
  });

  /** The tape's own time span, split into equal buckets, counted by risk band. */
  readonly volume = computed<readonly VolumeBucket[]>(() => {
    const rows = this.rows();
    if (rows.length === 0) return [];
    const times = rows.map((row) => Date.parse(row.occurredAt));
    const first = Math.min(...times);
    const span = Math.max(1, Math.max(...times) - first + 1);
    const buckets = Array.from({ length: BUCKETS }, (_, index) => ({
      start: new Date(first + (span * index) / BUCKETS).toISOString(),
      counts: { LOW: 0, ELEVATED: 0, HIGH: 0, CRITICAL: 0 } as Record<RiskBand, number>,
      total: 0,
    }));
    for (const row of rows) {
      const bucket = buckets[Math.min(BUCKETS - 1, Math.floor(((Date.parse(row.occurredAt) - first) / span) * BUCKETS))];
      if (!bucket) continue;
      bucket.counts[row.band] += 1;
      bucket.total += 1;
    }
    return buckets;
  });

  readonly distribution = computed(() => {
    const rows = this.rows();
    return BANDS.map((band) => ({ band, count: rows.filter((row) => row.band === band).length }));
  });

  readonly byBank = computed(() => {
    const rows = this.rows();
    const total = rows.length || 1;
    const groups = new Map<string, { count: number; value: number; high: number; held: number }>();
    for (const row of rows) {
      const group = groups.get(row.institutionId) ?? { count: 0, value: 0, high: 0, held: 0 };
      group.count += 1;
      group.value += row.amount;
      if (row.band === 'HIGH' || row.band === 'CRITICAL') group.high += 1;
      if (row.decision !== 'ALLOW') group.held += 1;
      groups.set(row.institutionId, group);
    }
    return [...groups.entries()]
      .map(([id, group]) => ({ id, label: institution(id), ...group, share: (group.count / total) * 100 }))
      .sort((a, b) => b.count - a.count);
  });

  /** How often each rule fired on the accounts' latest assessments in the current scope. */
  readonly signals = computed(() => {
    const accounts = new Set(this.rows().map((row) => row.accountId));
    const counts = new Map<RiskRuleCode, number>();
    for (const record of Object.values(this.latestByAccount())) {
      if (!accounts.has(record.accountId)) continue;
      for (const contribution of record.assessment.contributions) {
        if (contribution.points > 0) counts.set(contribution.code, (counts.get(contribution.code) ?? 0) + 1);
      }
    }
    const max = Math.max(1, ...counts.values());
    return [...counts.entries()].map(([code, count]) => ({ code, label: RULE_LABELS[code], count, share: (count / max) * 100 })).sort((a, b) => b.count - a.count);
  });

  readonly reports = computed<readonly ReportDefinition[]>(() => {
    const kpis = this.kpis();
    return [
      { id: 'decisions', title: 'Decision register', description: 'Every scored transfer in scope with its score, band, decision and reason codes.', rows: kpis.transactions },
      { id: 'high-risk', title: 'High-risk transfers', description: 'Transfers scored HIGH or CRITICAL, with the policy decision recorded for each.', rows: kpis.highRisk },
      { id: 'interventions', title: 'Intervention log', description: 'The latest intervention record for each held transfer in scope.', rows: kpis.interventions },
      { id: 'accounts', title: 'Account risk summary', description: 'Each account in scope with its latest score, band, decision and 24h drain.', rows: kpis.accounts },
    ];
  });

  /** A report as CSV, built from the same records the charts show. */
  reportCsv(id: ReportDefinition['id']): string {
    const cell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const join = (header: readonly string[], lines: readonly (readonly (string | number)[])[]) =>
      [header.map(cell).join(','), ...lines.map((line) => line.map(cell).join(','))].join('\r\n');
    const rows = this.rows();
    const transferLine = (row: TapeRow) => [row.occurredAt, row.transactionId, row.accountReference ?? row.accountId, institution(row.institutionId), institution(row.destinationInstitutionId), (row.amount / 100).toFixed(2), row.score, row.band, row.decision, row.reasonCodes.join(' ')];
    const transferHeader = ['Occurred (UTC)', 'Transaction', 'Account', 'From', 'To', 'Amount (SGD)', 'Score', 'Band', 'Decision', 'Reason codes'];
    if (id === 'decisions') return join(transferHeader, rows.map(transferLine));
    if (id === 'high-risk') return join(transferHeader, rows.filter((row) => row.band === 'HIGH' || row.band === 'CRITICAL').map(transferLine));
    if (id === 'interventions') {
      const ids = new Set(rows.map((row) => row.transactionId));
      return join(
        ['Acted (UTC)', 'Transaction', 'Account', 'State', 'Previous state', 'Actor', 'Reason codes'],
        this.interventions()
          .filter((intervention) => ids.has(intervention.transactionId))
          .map((intervention) => [intervention.actedAt, intervention.transactionId, intervention.accountId, intervention.state, intervention.previousState, intervention.actor, intervention.reasonCodes.join(' ')]),
      );
    }
    const accounts = new Set(rows.map((row) => row.accountId));
    return join(
      ['Account', 'Account token', 'Institution', 'Latest score', 'Band', 'Latest decision', '24h drain %', 'Last activity (UTC)'],
      Object.values(this.latestByAccount())
        .filter((record) => accounts.has(record.accountId))
        .map((record) => [record.accountReference ?? record.accountId, record.accountId, institution(record.institutionId), record.assessment.score, record.band, record.decision, record.assessment.drain.drainPct.toFixed(1), record.occurredAt]),
    );
  }
}
