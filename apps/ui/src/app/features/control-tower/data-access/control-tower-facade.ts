import { Injectable, computed, inject, type Signal } from '@angular/core';
import { Store } from '@ngrx/store';
import type { DecisionRecord, Intervention } from '@sentinel/domain';
import {
  selectFocusedDecision,
  selectFocusedTimeline,
  selectLatestHoldNotice,
  type AccountEvent,
  type HoldNotice,
} from '../../../state/account-focus/account-focus.selectors';
import { alertsFeature } from '../../../state/alerts/alerts.feature';
import { interventionsFeature } from '../../../state/interventions/interventions.feature';
import { sessionFeature, type StreamConnectionStatus } from '../../../state/session/session.feature';
import { transactionsFeature } from '../../../state/transactions/transactions.feature';
import type { LiveMetricsView } from '../models/live-metrics-view';

/** What the control-tower page consumes. Pages talk to the facade, never to the store or HTTP directly. */
@Injectable({ providedIn: 'root' })
export class ControlTowerFacade {
  private readonly store = inject(Store);
  private readonly tape = this.store.selectSignal(transactionsFeature.selectTape);
  private readonly openAlerts = this.store.selectSignal(alertsFeature.selectOpenAlerts);
  private readonly activeHolds = this.store.selectSignal(interventionsFeature.selectActiveHolds);
  private readonly latestByTransaction = this.store.selectSignal(interventionsFeature.selectLatestByTransaction);

  readonly focusedDecision: Signal<DecisionRecord | null> = this.store.selectSignal(selectFocusedDecision);
  readonly timeline: Signal<readonly AccountEvent[]> = this.store.selectSignal(selectFocusedTimeline);
  readonly streamStatus: Signal<StreamConnectionStatus> = this.store.selectSignal(sessionFeature.selectStreamStatus);
  readonly latestHoldNotice: Signal<HoldNotice | null> = this.store.selectSignal(selectLatestHoldNotice);

  /** The latest intervention for the focused transaction: HELD, or what released or cancelled it. */
  readonly focusedIntervention: Signal<Intervention | null> = computed(() => {
    const decision = this.focusedDecision();
    if (!decision) return null;
    return this.latestByTransaction().find((intervention) => intervention.transactionId === decision.transactionId) ?? null;
  });

  readonly metrics: Signal<LiveMetricsView> = computed(() => {
    const amountByTransaction = new Map(this.tape().map((row) => [row.transactionId, row.amount]));
    const holds = this.activeHolds();
    return {
      transactionsScored: this.tape().length,
      openAlerts: this.openAlerts().length,
      transactionsOnHold: holds.length,
      valueOnHold: holds.reduce((total, hold) => total + (amountByTransaction.get(hold.transactionId) ?? 0), 0),
    };
  });
}
