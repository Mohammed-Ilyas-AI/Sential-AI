import type { Alert } from '@sentinel/domain';
import { createFeature, createReducer } from '@ngrx/store';

/** Cross-route domain state: read by the control tower, investigations and cases. */
export interface AlertsState {
  readonly openAlerts: readonly Alert[];
  readonly selectedAlertId: string | null;
}

const initialAlertsState: AlertsState = { openAlerts: [], selectedAlertId: null };

export const alertsFeature = createFeature({
  name: 'alerts',
  reducer: createReducer(initialAlertsState),
});
