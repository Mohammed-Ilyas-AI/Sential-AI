import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal, type Signal } from '@angular/core';
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
import { InterventionsActions } from '../../../state/interventions/interventions.actions';
import { interventionsFeature } from '../../../state/interventions/interventions.feature';
import { transactionsFeature } from '../../../state/transactions/transactions.feature';
import { sessionFeature } from '../../../state/session/session.feature';
import { toAccountRiskView, type AccountRiskView } from '../models/account-risk-view';
import { InterventionsApi } from './interventions-api';

/** The exceptions an analyst works around a policy hold (M§5.3). None of them is a release on judgement. */
export type InterventionAction = 'customer-verified-release' | 'customer-cancellation' | 'fraud-confirmation';

/** A transfer on the focused account that is still held, and whether the hold cascade put it there. */
export interface ActiveHold {
  readonly intervention: Intervention;
  readonly amount: number | null;
  readonly cascaded: boolean;
}

function failureMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return 'The action could not be recorded.';
  if (error.status === 0) return 'sentinel-core is unreachable; nothing was recorded.';
  if (error.status === 409) return 'This hold has already moved; the audit trail shows its current state.';
  return `sentinel-core refused the action (HTTP ${error.status}); nothing was recorded.`;
}

/** The alert queue and the account in focus: its drain state, the gate's decision, its timeline. */
@Injectable({ providedIn: 'root' })
export class FraudAlertsFacade {
  private readonly store = inject(Store);
  private readonly interventionsApi = inject(InterventionsApi);
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

  private readonly activeHolds = this.store.selectSignal(interventionsFeature.selectActiveHolds);
  private readonly tape = this.store.selectSignal(transactionsFeature.selectTape);

  /** Every transfer on the focused account still in the hold state: the trigger and each cascaded outflow. */
  readonly focusedHolds: Signal<readonly ActiveHold[]> = computed(() => {
    const accountId = this.focusedAccountId();
    if (!accountId) return [];
    const amounts = new Map(this.tape().map((row) => [row.transactionId, row.amount]));
    return this.activeHolds()
      .filter((intervention) => intervention.accountId === accountId)
      .map((intervention) => ({
        intervention,
        amount: amounts.get(intervention.transactionId) ?? null,
        cascaded: intervention.cascadeOfTransactionId !== undefined,
      }))
      .sort((left, right) => right.intervention.actedAt.localeCompare(left.intervention.actedAt));
  });

  readonly analystIdentity: Signal<string | null> = this.store.selectSignal(sessionFeature.selectAnalystIdentity);
  private readonly pending = signal<InterventionAction | null>(null);
  private readonly failure = signal<string | null>(null);
  readonly pendingAction: Signal<InterventionAction | null> = this.pending.asReadonly();
  readonly actionFailure: Signal<string | null> = this.failure.asReadonly();

  /** Records the action on the server; the appended record also arrives on the stream and is deduplicated by id. */
  act(action: InterventionAction, transactionId: string): void {
    const analystIdentity = this.analystIdentity();
    const request =
      action === 'customer-verified-release'
        ? this.interventionsApi.releaseAfterCustomerVerification(transactionId)
        : action === 'customer-cancellation'
          ? this.interventionsApi.cancelByCustomer(transactionId)
          : analystIdentity
            ? this.interventionsApi.confirmFraud(transactionId, analystIdentity)
            : null;
    if (!request) {
      this.failure.set('Confirming fraud needs a signed-in analyst identity.');
      return;
    }
    this.pending.set(action);
    this.failure.set(null);
    request.subscribe({
      next: (intervention) => {
        this.store.dispatch(InterventionsActions.interventionAppended({ intervention }));
        this.pending.set(null);
      },
      error: (error: unknown) => {
        this.failure.set(failureMessage(error));
        this.pending.set(null);
      },
    });
  }

  select(accountId: string): void {
    this.store.dispatch(AlertsActions.accountSelected({ accountId }));
  }
}
