import type { Alert } from '@sentinel/domain';
import { createActionGroup, props } from '@ngrx/store';

export const AlertsActions = createActionGroup({
  source: 'Alerts',
  events: {
    'Snapshot Loaded': props<{ readonly alerts: readonly Alert[] }>(),
    'Alert Upserted': props<{ readonly alert: Alert }>(),
    'Account Selected': props<{ readonly accountId: string }>(),
  },
});
