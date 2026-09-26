import { Injectable, computed, inject, type Signal } from '@angular/core';
import { Store } from '@ngrx/store';
import type { Alert } from '@sentinel/domain';
import { selectFocusedDecision } from '../../../state/account-focus/account-focus.selectors';
import { AlertsActions } from '../../../state/alerts/alerts.actions';
import { alertsFeature } from '../../../state/alerts/alerts.feature';
import { toAccountRiskView, type AccountRiskView } from '../models/account-risk-view';

@Injectable({ providedIn: 'root' })
export class FraudAlertsFacade {
  private readonly store = inject(Store);
  private readonly focusedDecision = this.store.selectSignal(selectFocusedDecision);

  /** Sorted by risk, newest critical first. */
  readonly queue: Signal<readonly Alert[]> = this.store.selectSignal(alertsFeature.selectQueue);
  readonly focusedAccountId: Signal<string | null> = this.store.selectSignal(alertsFeature.selectFocusedAccountId);
  readonly selectedAccount: Signal<AccountRiskView | null> = computed(() => {
    const decision = this.focusedDecision();
    return decision ? toAccountRiskView(decision) : null;
  });

  select(accountId: string): void {
    this.store.dispatch(AlertsActions.accountSelected({ accountId }));
  }
}
