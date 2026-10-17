import { DestroyRef, Injectable, computed, inject, signal, type Signal } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import type { Intervention, InterventionState, MinorUnits } from '@sentinel/domain';
import { AlertsActions } from '../../../state/alerts/alerts.actions';
import { interventionsFeature } from '../../../state/interventions/interventions.feature';
import { transactionsFeature } from '../../../state/transactions/transactions.feature';

/** A held or resolved transaction: its latest record, the amount from the tape and its full append-only history. */
export interface InterventionRow {
  readonly latest: Intervention;
  readonly history: readonly Intervention[];
  readonly amount: MinorUnits | null;
  readonly reference: string;
  /** Seconds to auto-release while HELD; null otherwise. */
  readonly secondsLeft: number | null;
}

/**
 * The append-only intervention record across every account (M§5.3). Read-only here: the exceptions an analyst may
 * work (customer verification, cancellation, fraud confirmation) live in Alerts & cases, and there is no analyst
 * release.
 */
@Injectable()
export class InterventionsWorkspaceFacade {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly byTransaction = this.store.selectSignal(interventionsFeature.selectByTransactionId);
  private readonly tape = this.store.selectSignal(transactionsFeature.selectTape);
  private readonly now = signal(Date.now());

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 1_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  readonly rows: Signal<readonly InterventionRow[]> = computed(() => {
    const tapeByTransaction = new Map(this.tape().map((row) => [row.transactionId, row]));
    const now = this.now();
    return Object.values(this.byTransaction())
      .filter((history) => history.length > 0)
      .map((history) => {
        const latest = history[history.length - 1] as Intervention;
        const row = tapeByTransaction.get(latest.transactionId);
        const until = latest.state === 'HELD' && latest.holdUntil ? Math.max(0, Math.round((Date.parse(latest.holdUntil) - now) / 1_000)) : null;
        return { latest, history, amount: row?.amount ?? null, reference: row?.accountReference ?? latest.accountId, secondsLeft: until };
      })
      .sort((left, right) => Number(right.latest.state === 'HELD') - Number(left.latest.state === 'HELD') || right.latest.actedAt.localeCompare(left.latest.actedAt));
  });

  readonly counts = computed(() => {
    const counts: Record<InterventionState, number> = { HELD: 0, RELEASED: 0, REJECTED: 0, CANCELLED: 0 };
    for (const row of this.rows()) counts[row.latest.state] += 1;
    return counts;
  });

  readonly valueHeld = computed(() => this.rows().reduce((sum, row) => (row.latest.state === 'HELD' && row.amount ? sum + row.amount : sum), 0));

  work(accountId: string): void {
    this.store.dispatch(AlertsActions.accountSelected({ accountId }));
    void this.router.navigate(['/alerts']);
  }
}
