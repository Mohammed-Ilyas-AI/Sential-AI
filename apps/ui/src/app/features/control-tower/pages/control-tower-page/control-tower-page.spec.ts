import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideTestStore } from '../../../../../testing/provide-test-store';
import { demoAlert, demoFinalDecision, demoHold, demoThirdDecision } from '../../../../../testing/ui-fixtures';
import { AlertsActions } from '../../../../state/alerts/alerts.actions';
import { InterventionsActions } from '../../../../state/interventions/interventions.actions';
import { SessionActions } from '../../../../state/session/session.actions';
import { TransactionsActions } from '../../../../state/transactions/transactions.actions';
import { ControlTowerPage } from './control-tower-page';

async function render(): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(ControlTowerPage);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const textOf = (host: HTMLElement, selector: string): string =>
  (host.querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('ControlTowerPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ControlTowerPage], providers: [provideTestStore()] }).compileComponents();
  });

  it('composes the tape, alert queue, rapid-drain panel, policy gate and timeline', async () => {
    const host = await render();
    for (const selector of [
      'sentinel-system-health',
      'sentinel-live-metrics',
      'sentinel-transaction-tape',
      'sentinel-alert-queue',
      'sentinel-account-risk-panel',
      'sentinel-policy-hold',
      'sentinel-account-timeline',
    ]) {
      expect(host.querySelector(selector), selector).not.toBeNull();
    }
    expect(host.querySelector('sentinel-customer-notification')).toBeNull();
  });

  it('shows DEMO_TAKEOVER_01 held: amount, account, 95 CRITICAL, HOLD, 65.4% drain, contributions and timeline', async () => {
    const store = TestBed.inject(Store);
    store.dispatch(SessionActions.streamStatusChanged({ status: 'LIVE' }));
    store.dispatch(
      TransactionsActions.snapshotLoaded({ decisions: [demoThirdDecision(), demoFinalDecision()], cursor: 'cursor-1' }),
    );
    store.dispatch(AlertsActions.snapshotLoaded({ alerts: [demoAlert()] }));
    store.dispatch(InterventionsActions.snapshotLoaded({ interventions: [demoHold()] }));
    const host = await render();

    expect(textOf(host, 'sentinel-system-health')).toContain('Stream live');

    const firstRow = textOf(host, 'sentinel-transaction-tape tbody tr');
    expect(firstRow).toContain('ACC-10291');
    expect(firstRow).toContain('S$11,500.00');
    expect(firstRow).toContain('95');
    expect(firstRow).toContain('HOLD');
    expect(host.querySelector('sentinel-transaction-tape tbody tr')?.classList).toContain('held');

    expect(textOf(host, 'sentinel-alert-queue')).toContain('CRITICAL');

    const drain = textOf(host, 'sentinel-account-risk-panel');
    expect(drain).toContain('S$52,000.00');
    expect(drain).toContain('S$34,000.00');
    expect(drain).toContain('65.4%');
    expect(drain).toContain('Threshold exceeded');

    const gate = textOf(host, 'sentinel-policy-hold');
    expect(textOf(host, 'sentinel-policy-hold .state')).toBe('HOLD');
    expect(gate).toContain('24-hour policy hold in force');
    expect(gate).toContain('Intervention: HELD by SYSTEM');
    expect(gate).toContain('SG-RD-50_THRESHOLD_EXCEEDED');
    for (const label of ['Rapid account depletion', 'New device', 'New beneficiary', 'Transaction velocity']) {
      expect(gate).toContain(label);
    }
    expect(gate).toContain('Advisory score 95 / 100');

    const timeline = textOf(host, 'sentinel-account-timeline');
    expect(timeline).toContain('EVALUATING → HELD (SYSTEM)');
    expect(timeline).toContain('ALLOW S$7,200.00');

    expect(textOf(host, 'sentinel-live-metrics .kpi:nth-child(3) .value')).toBe('1');
    expect(textOf(host, 'sentinel-live-metrics .kpi:nth-child(4) .value')).toBe('S$11,500.00');
    expect(textOf(host, 'sentinel-customer-notification')).toContain('Bank A');
  });

  it('shows the release once the customer verifies, and stops counting the hold', async () => {
    const store = TestBed.inject(Store);
    store.dispatch(TransactionsActions.snapshotLoaded({ decisions: [demoFinalDecision()], cursor: 'cursor-1' }));
    store.dispatch(AlertsActions.snapshotLoaded({ alerts: [demoAlert()] }));
    store.dispatch(InterventionsActions.snapshotLoaded({ interventions: [demoHold()] }));
    store.dispatch(
      InterventionsActions.interventionAppended({
        intervention: demoHold({ id: 'int_demo_2', previousState: 'HELD', state: 'RELEASED', actor: 'CUSTOMER' }),
      }),
    );
    const host = await render();

    expect(textOf(host, 'sentinel-policy-hold')).toContain('Hold ended: RELEASED');
    expect(textOf(host, 'sentinel-live-metrics .kpi:nth-child(3) .value')).toBe('0');
    expect(host.querySelector('sentinel-customer-notification')).toBeNull();
  });
});
