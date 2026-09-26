import { Injectable, inject, type Signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { AlertsActions } from '../../../state/alerts/alerts.actions';
import { alertsFeature } from '../../../state/alerts/alerts.feature';
import { transactionsFeature } from '../../../state/transactions/transactions.feature';
import type { TapeRow } from '../../../workers/transaction-worker-protocol';

/** WebSocket, 250 ms bufferTime, worker round-trip, one NgRx action per batch; the tape reads only this. */
@Injectable({ providedIn: 'root' })
export class TransactionStreamFacade {
  private readonly store = inject(Store);

  readonly tapeRows: Signal<readonly TapeRow[]> = this.store.selectSignal(transactionsFeature.selectTape);
  readonly focusedAccountId: Signal<string | null> = this.store.selectSignal(alertsFeature.selectFocusedAccountId);

  focus(accountId: string): void {
    this.store.dispatch(AlertsActions.accountSelected({ accountId }));
  }
}
