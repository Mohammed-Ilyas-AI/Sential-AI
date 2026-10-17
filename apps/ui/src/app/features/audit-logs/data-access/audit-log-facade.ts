import { Injectable, computed, inject, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { interventionsFeature } from '../../../state/interventions/interventions.feature';
import { transactionsFeature } from '../../../state/transactions/transactions.feature';

export type AuditKind = 'DECISION' | 'INTERVENTION';

/** One audit entry: who decided or acted, on what, why, under which policy, joinable by trace or transaction. */
export interface AuditEntry {
  readonly id: string;
  readonly at: string;
  readonly kind: AuditKind;
  readonly transactionId: string;
  readonly account: string;
  readonly action: string;
  readonly actor: string;
  readonly reasons: string;
  readonly policyVersion: string;
  readonly rulesetVersion: string;
  readonly reference: string;
}

const CSV_COLUMNS: readonly (keyof AuditEntry)[] = ['at', 'kind', 'transactionId', 'account', 'action', 'actor', 'reasons', 'policyVersion', 'rulesetVersion', 'reference'];

const csvCell = (value: string): string => (/[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);

/** The audit trail as recorded: decisions from the tape, intervention transitions append-only. Exportable. */
@Injectable()
export class AuditLogFacade {
  private readonly store = inject(Store);
  private readonly tape = this.store.selectSignal(transactionsFeature.selectTape);
  private readonly interventions = this.store.selectSignal(interventionsFeature.selectAllInterventions);

  readonly filter = signal<'ALL' | AuditKind | 'HOLDS'>('ALL');
  readonly query = signal('');

  private readonly all = computed((): readonly AuditEntry[] => {
    const references = new Map(this.tape().map((row) => [row.accountId, row.accountReference ?? row.accountId]));
    const decisions: AuditEntry[] = this.tape().map((row) => ({
      id: `d-${row.transactionId}`,
      at: row.decidedAt,
      kind: 'DECISION',
      transactionId: row.transactionId,
      account: row.accountReference ?? row.accountId,
      action: `${row.decision} · score ${row.score} ${row.band}`,
      actor: 'Deterministic policy gate',
      reasons: row.reasonCodes.join(', '),
      policyVersion: row.policyVersion,
      rulesetVersion: row.rulesetVersion,
      reference: row.traceId,
    }));
    const transitions: AuditEntry[] = this.interventions().map((record) => ({
      id: `i-${record.id}`,
      at: record.actedAt,
      kind: 'INTERVENTION',
      transactionId: record.transactionId,
      account: references.get(record.accountId) ?? record.accountId,
      action: `${record.previousState} → ${record.state}`,
      actor: `${record.actor.toLowerCase()}${record.actorIdentity ? ` · ${record.actorIdentity}` : ''}`,
      reasons: record.reasonCodes.join(', '),
      policyVersion: record.policyVersion,
      rulesetVersion: record.rulesetVersion,
      reference: record.decisionId,
    }));
    return [...decisions, ...transitions].sort((left, right) => right.at.localeCompare(left.at));
  });

  readonly entries = computed(() => {
    const filter = this.filter();
    const query = this.query().trim().toLowerCase();
    return this.all().filter((entry) => {
      if (filter === 'DECISION' || filter === 'INTERVENTION') {
        if (entry.kind !== filter) return false;
      } else if (filter === 'HOLDS' && !entry.action.includes('HOLD') && !entry.action.includes('HELD')) return false;
      return query === '' || Object.values(entry).some((value) => value.toLowerCase().includes(query));
    });
  });

  readonly total = computed(() => this.all().length);

  /** The filtered view as CSV, for second-line review. */
  csv(): string {
    const lines = this.entries().map((entry) => CSV_COLUMNS.map((column) => csvCell(entry[column])).join(','));
    return [CSV_COLUMNS.join(','), ...lines].join('\n');
  }
}
