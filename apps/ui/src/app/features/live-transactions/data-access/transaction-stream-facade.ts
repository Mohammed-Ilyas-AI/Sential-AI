import { Injectable, computed, inject, type Signal } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import type { InterventionState } from '@sentinel/domain';
import { AlertsActions } from '../../../state/alerts/alerts.actions';
import { alertsFeature } from '../../../state/alerts/alerts.feature';
import { interventionsFeature } from '../../../state/interventions/interventions.feature';
import { transactionsFeature } from '../../../state/transactions/transactions.feature';
import type { TapeRow } from '../../../workers/transaction-worker-protocol';

/** WebSocket, 250 ms bufferTime, worker round-trip, one NgRx action per batch; the tape reads only this. */
@Injectable({ providedIn: 'root' })
export class TransactionStreamFacade {
  private readonly store = inject(Store);
  private readonly router = inject(Router);

  readonly tapeRows: Signal<readonly TapeRow[]> = this.store.selectSignal(transactionsFeature.selectTape);
  readonly focusedAccountId: Signal<string | null> = this.store.selectSignal(alertsFeature.selectFocusedAccountId);

  /** The latest intervention state per transaction, as the server recorded it; absent when there is none. */
  private readonly interventions = this.store.selectSignal(interventionsFeature.selectByTransactionId);
  readonly interventionStates: Signal<Readonly<Record<string, InterventionState>>> = computed(() =>
    Object.fromEntries(
      Object.entries(this.interventions()).flatMap(([transactionId, history]) => {
        const latest = history.at(-1);
        return latest ? [[transactionId, latest.state]] : [];
      }),
    ),
  );

  focus(accountId: string): void {
    this.store.dispatch(AlertsActions.accountSelected({ accountId }));
  }

  /** The investigation workspace opens on the focused account's latest assessment. */
  openInvestigation(accountId: string): void {
    this.focus(accountId);
    void this.router.navigateByUrl('/investigations');
  }
}
