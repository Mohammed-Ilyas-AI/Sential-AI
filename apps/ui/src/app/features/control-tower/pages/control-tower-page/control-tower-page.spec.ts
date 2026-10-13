import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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

function loadDemoHold(): void {
  const store = TestBed.inject(Store);
  store.dispatch(SessionActions.streamStatusChanged({ status: 'LIVE' }));
  store.dispatch(TransactionsActions.snapshotLoaded({ decisions: [demoThirdDecision(), demoFinalDecision()], cursor: 'cursor-1' }));
  store.dispatch(AlertsActions.snapshotLoaded({ alerts: [demoAlert()] }));
  store.dispatch(InterventionsActions.snapshotLoaded({ interventions: [demoHold()] }));
}

describe('ControlTowerPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ControlTowerPage], providers: [provideTestStore(), provideRouter([])] }).compileComponents();
  });

  it('composes exactly the reference surfaces, and nothing for searching or operating', async () => {
    const host = await render();
    for (const selector of [
      'sentinel-kpi-card',
      'sentinel-live-global-network',
      'sentinel-operations-globe',
      'sentinel-transaction-stream',
      'sentinel-risk-analysis',
      'sentinel-system-status',
      'sentinel-notification-list',
      'sentinel-threat-landscape',
      'sentinel-policy-gate',
    ]) {
      expect(host.querySelector(selector), selector).not.toBeNull();
    }
    expect(host.querySelectorAll('sentinel-kpi-card')).toHaveLength(4);
    expect(host.querySelector('input, [role="search"], [role="combobox"]')).toBeNull();
    expect(host.querySelector('sentinel-transaction-tape, sentinel-alert-queue, sentinel-policy-hold')).toBeNull();
  });

  it('shows DEMO_TAKEOVER_01 held across the tower', async () => {
    loadDemoHold();
    const host = await render();

    expect(textOf(host, 'h1')).toBe('Global Financial Defence in Real Time');
    const kpis = [...host.querySelectorAll('sentinel-kpi-card')].map((card) => (card.textContent ?? '').replace(/\s+/g, ' ').trim());
    expect(kpis[0]).toMatch(/^Live Transactions\s*2/);
    expect(kpis[1]).toMatch(/^High Risk Alerts\s*1/);
    expect(kpis[2]).toMatch(/^Held Transactions\s*1/);
    expect(kpis[3]).toMatch(/^Monitored Banks\s*3/);

    const firstRow = textOf(host, 'sentinel-transaction-stream tbody tr');
    expect(firstRow).toContain('S$11,500.00');
    expect(firstRow).toContain('Bank A → Bank C');
    expect(firstRow).toContain('95');
    expect(firstRow).toContain('HOLD');

    const callout = textOf(host, 'sentinel-operations-globe .callout[data-tone="held"]');
    expect(callout).toContain('S$11,500.00');
    expect(callout).toContain('HOLD');

    expect(textOf(host, 'sentinel-risk-analysis .score')).toBe('95');
    expect(textOf(host, 'sentinel-risk-analysis ul')).toContain('Rapid Drain+30');

    const gate = textOf(host, 'sentinel-policy-gate');
    expect(gate).toContain('HOLD');
    expect(gate).toContain('24h outflow 65.4% (> 50%)');
    expect(gate).toContain('Intervention required');

    expect(textOf(host, '.alerts')).toContain('High-risk transaction held');
    expect(textOf(host, 'sentinel-system-status')).toContain('Control path operational');
    expect(textOf(host, 'sentinel-threat-landscape .legend')).toContain('High Risk 2');
    expect(textOf(host, 'sentinel-live-global-network .stat')).toBe('3Banks Connected');
  });

  it('shows the release once the customer verifies it', async () => {
    loadDemoHold();
    TestBed.inject(Store).dispatch(
      InterventionsActions.interventionAppended({
        intervention: demoHold({ id: 'int_demo_2', previousState: 'HELD', state: 'RELEASED', actor: 'CUSTOMER' }),
      }),
    );
    const host = await render();
    expect(textOf(host, 'sentinel-policy-gate')).toContain('Hold released');
    expect(textOf(host, 'sentinel-kpi-card:nth-child(3) .value')).toBe('0');
  });
});
