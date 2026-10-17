import { Injectable, computed, inject, type Signal } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import type { DecisionRecord, DrainState, InstitutionId, RiskBand } from '@sentinel/domain';
import { AlertsActions } from '../../../state/alerts/alerts.actions';
import { alertsFeature } from '../../../state/alerts/alerts.feature';
import { interventionsFeature } from '../../../state/interventions/interventions.feature';
import { transactionsFeature } from '../../../state/transactions/transactions.feature';

/** One account as the workspace lists it: the latest decision's own drain snapshot, never recomputed here. */
export interface AccountRow {
  readonly accountId: string;
  readonly reference: string;
  readonly institutionId: InstitutionId;
  readonly latest: DecisionRecord;
  readonly band: RiskBand;
  readonly drain: DrainState;
  readonly activeHolds: number;
  readonly openAlert: boolean;
  readonly transfers: number;
}

/** Every account seen on the stream, riskiest first (M§5.2). Read-only; focusing hands over to Alerts & cases. */
@Injectable()
export class AccountsFacade {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly latestByAccount = this.store.selectSignal(transactionsFeature.selectLatestByAccount);
  private readonly tape = this.store.selectSignal(transactionsFeature.selectTape);
  private readonly alerts = this.store.selectSignal(alertsFeature.selectOpenAlerts);
  private readonly holds = this.store.selectSignal(interventionsFeature.selectActiveHolds);

  readonly accounts: Signal<readonly AccountRow[]> = computed(() => {
    const transfers = new Map<string, number>();
    for (const row of this.tape()) transfers.set(row.accountId, (transfers.get(row.accountId) ?? 0) + 1);
    const alerted = new Set(this.alerts().filter((alert) => alert.status === 'OPEN').map((alert) => alert.accountId));
    const holds = new Map<string, number>();
    for (const hold of this.holds()) holds.set(hold.accountId, (holds.get(hold.accountId) ?? 0) + 1);
    return Object.values(this.latestByAccount())
      .map((latest) => ({
        accountId: latest.accountId,
        reference: latest.accountReference ?? latest.accountId,
        institutionId: latest.institutionId,
        latest,
        band: latest.band,
        drain: latest.assessment.drain,
        activeHolds: holds.get(latest.accountId) ?? 0,
        openAlert: alerted.has(latest.accountId),
        transfers: transfers.get(latest.accountId) ?? 0,
      }))
      .sort((left, right) => right.latest.riskScore - left.latest.riskScore || right.drain.drainPct - left.drain.drainPct);
  });

  readonly overGate = computed(() => this.accounts().filter((account) => account.drain.thresholdMet).length);
  readonly withHolds = computed(() => this.accounts().filter((account) => account.activeHolds > 0).length);
  readonly withAlerts = computed(() => this.accounts().filter((account) => account.openAlert).length);

  focus(accountId: string): void {
    this.store.dispatch(AlertsActions.accountSelected({ accountId }));
    void this.router.navigate(['/alerts']);
  }
}
