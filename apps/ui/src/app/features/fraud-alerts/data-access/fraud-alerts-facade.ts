import { Injectable, computed, inject, type Signal } from '@angular/core';
import { Store } from '@ngrx/store';
import type { Alert, DecisionRecord, Intervention } from '@sentinel/domain';
import {
  selectFocusedDecision,
  selectFocusedTimeline,
  selectLatestHoldNotice,
  type AccountEvent,
  type HoldNotice,
} from '../../../state/account-focus/account-focus.selectors';
import { AlertsActions } from '../../../state/alerts/alerts.actions';
import { alertsFeature } from '../../../state/alerts/alerts.feature';
import { interventionsFeature } from '../../../state/interventions/interventions.feature';
import { toAccountRiskView, type AccountRiskView } from '../models/account-risk-view';

/** The alert queue and the account in focus: its drain state, the gate's decision, its timeline. */
@Injectable({ providedIn: 'root' })
export class FraudAlertsFacade {
  private readonly store = inject(Store);
  private readonly latestByTransaction = this.store.selectSignal(interventionsFeature.selectLatestByTransaction);

  /** Sorted by risk, newest critical first. */
  readonly queue: Signal<readonly Alert[]> = this.store.selectSignal(alertsFeature.selectQueue);
  readonly focusedAccountId: Signal<string | null> = this.store.selectSignal(alertsFeature.selectFocusedAccountId);
  readonly focusedDecision: Signal<DecisionRecord | null> = this.store.selectSignal(selectFocusedDecision);
  readonly timeline: Signal<readonly AccountEvent[]> = this.store.selectSignal(selectFocusedTimeline);
  readonly latestHoldNotice: Signal<HoldNotice | null> = this.store.selectSignal(selectLatestHoldNotice);

  readonly selectedAccount: Signal<AccountRiskView | null> = computed(() => {
    const decision = this.focusedDecision();
    return decision ? toAccountRiskView(decision) : null;
  });

  /** The latest intervention for the focused transaction: HELD, or what released or cancelled it. */
  readonly focusedIntervention: Signal<Intervention | null> = computed(() => {
    const decision = this.focusedDecision();
    if (!decision) return null;
    return this.latestByTransaction().find((intervention) => intervention.transactionId === decision.transactionId) ?? null;
  });

  select(accountId: string): void {
    this.store.dispatch(AlertsActions.accountSelected({ accountId }));
  }
}
