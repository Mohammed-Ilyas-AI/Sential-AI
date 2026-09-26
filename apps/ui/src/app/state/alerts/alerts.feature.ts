import type { Alert } from '@sentinel/domain';
import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import { AlertsActions } from './alerts.actions';

/** Cross-route domain state: read by the control tower, investigations and cases. */
export interface AlertsState {
  readonly openAlerts: readonly Alert[];
  readonly selectedAccountId: string | null;
}

const initialAlertsState: AlertsState = { openAlerts: [], selectedAccountId: null };

/** Sorted by risk, newest critical first (M§5.1). */
const byRiskThenNewest = (left: Alert, right: Alert): number => right.score - left.score || right.updatedAt.localeCompare(left.updatedAt);

export const alertsFeature = createFeature({
  name: 'alerts',
  reducer: createReducer(
    initialAlertsState,
    on(AlertsActions.snapshotLoaded, (state, { alerts }) => ({ ...state, openAlerts: alerts.filter((alert) => alert.status === 'OPEN') })),
    on(AlertsActions.alertUpserted, (state, { alert }) => ({
      ...state,
      openAlerts: [...state.openAlerts.filter((existing) => existing.id !== alert.id), ...(alert.status === 'OPEN' ? [alert] : [])],
    })),
    on(AlertsActions.accountSelected, (state, { accountId }) => ({ ...state, selectedAccountId: accountId })),
  ),
  extraSelectors: ({ selectOpenAlerts, selectSelectedAccountId }) => {
    const selectQueue = createSelector(selectOpenAlerts, (alerts) => [...alerts].sort(byRiskThenNewest));
    return {
      selectQueue,
      selectFocusedAccountId: createSelector(selectSelectedAccountId, selectQueue, (selected, queue) => selected ?? queue[0]?.accountId ?? null),
    };
  },
});
