import { describe, expect, it } from 'vitest';
import { demoAlert, demoFinalDecision, demoHold } from '../../../testing/ui-fixtures';
import { processTransactionBatch } from '../../workers/transaction-batch.processor';
import { selectOperationalNotifications } from './operational-notifications.selectors';

const rows = processTransactionBatch([demoFinalDecision()]).rows;
const latestByAccount = { [demoFinalDecision().accountId]: demoFinalDecision() };

describe('operational notifications', () => {
  it('raises the hold, the drain pattern, the critical alert and the flagged relationship, newest first', () => {
    const released = demoHold({ id: 'int_demo_2', previousState: 'HELD', state: 'RELEASED', actor: 'CUSTOMER', actedAt: '2026-09-24T01:01:30.000Z' });
    const notifications = selectOperationalNotifications.projector([demoHold(), released], [demoAlert()], latestByAccount, rows);
    expect(notifications.map((notification) => [notification.severity, notification.title])).toEqual([
      ['success', 'Customer verification received'],
      ['critical', 'High-risk transaction held'],
      ['info', 'Rapid drain pattern'],
      ['critical', 'Critical risk alert'],
      ['warning', 'Network relationship flagged'],
    ]);
    expect(notifications[1]?.description).toBe('ACC-10291 · policy SG-RD-50 · score 95');
  });

  it('stays quiet for low and elevated alerts', () => {
    const quiet = selectOperationalNotifications.projector([], [demoAlert({ band: 'ELEVATED', score: 49 })], {}, rows);
    expect(quiet).toEqual([]);
  });
});
