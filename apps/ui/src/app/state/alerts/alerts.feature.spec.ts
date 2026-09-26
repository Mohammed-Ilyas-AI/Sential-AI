import { describe, expect, it } from 'vitest';
import { demoAlert } from '../../../testing/ui-fixtures';
import { AlertsActions } from './alerts.actions';
import { alertsFeature } from './alerts.feature';

const reduce = alertsFeature.reducer;
const initial = reduce(undefined, { type: '@@init' });

describe('alerts feature', () => {
  const critical = demoAlert();
  const elevated = demoAlert({ id: 'alert_2', accountId: 'acct_2', score: 49, band: 'ELEVATED', onHold: false });

  it('queues open alerts highest risk first', () => {
    const state = reduce(initial, AlertsActions.snapshotLoaded({ alerts: [elevated, critical] }));
    expect(alertsFeature.selectQueue.projector(state.openAlerts).map((alert) => alert.id)).toEqual(['alert_demo', 'alert_2']);
  });

  it('replaces a promoted alert and drops a closed one', () => {
    const opened = reduce(initial, AlertsActions.alertUpserted({ alert: { ...critical, score: 75, band: 'HIGH' } }));
    const promoted = reduce(opened, AlertsActions.alertUpserted({ alert: critical }));
    expect(promoted.openAlerts).toEqual([critical]);
    const closed = reduce(promoted, AlertsActions.alertUpserted({ alert: { ...critical, status: 'CLOSED' } }));
    expect(closed.openAlerts).toEqual([]);
  });

  it('focuses the analyst selection, else the top of the queue', () => {
    const queue = [critical, elevated];
    expect(alertsFeature.selectFocusedAccountId.projector(null, queue)).toBe(critical.accountId);
    expect(alertsFeature.selectFocusedAccountId.projector('acct_2', queue)).toBe('acct_2');
  });
});
