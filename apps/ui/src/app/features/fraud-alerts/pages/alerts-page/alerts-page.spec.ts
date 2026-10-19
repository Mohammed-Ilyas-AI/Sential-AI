import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideTestStore } from '../../../../../testing/provide-test-store';
import { demoAlert, demoFinalDecision, demoHold } from '../../../../../testing/ui-fixtures';
import { LOCAL_RUNTIME_CONFIG, provideRuntimeConfig } from '../../../../core/config/runtime-config';
import { AlertsActions } from '../../../../state/alerts/alerts.actions';
import { InterventionsActions } from '../../../../state/interventions/interventions.actions';
import { TransactionsActions } from '../../../../state/transactions/transactions.actions';
import { AlertsPage } from './alerts-page';

const text = (element: Element | null | undefined): string => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('AlertsPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AlertsPage], providers: [provideTestStore(), provideRouter([]), provideRuntimeConfig(LOCAL_RUNTIME_CONFIG)] }).compileComponents();
  });

  async function render() {
    const fixture = TestBed.createComponent(AlertsPage);
    await fixture.whenStable();
    return { host: fixture.nativeElement as HTMLElement, settle: () => fixture.whenStable() };
  }

  function loadReleasedHold(): void {
    const store = TestBed.inject(Store);
    const decision = demoFinalDecision();
    const held = demoHold();
    store.dispatch(TransactionsActions.snapshotLoaded({ decisions: [decision], cursor: 'c1' }));
    store.dispatch(
      InterventionsActions.snapshotLoaded({
        interventions: [held, { ...held, id: 'int_demo_2', previousState: 'HELD', state: 'RELEASED', actedAt: '2026-09-24T01:01:09.000Z' }],
      }),
    );
    store.dispatch(
      AlertsActions.snapshotLoaded({
        alerts: [
          demoAlert(),
          // A second run's alert: same display reference, a different synthetic account and transaction.
          demoAlert({ id: 'alert_run_2', accountId: 'acct_tok_run2', transactionId: 'txn_run_2', updatedAt: '2026-09-23T10:00:00.000Z' }),
        ],
      }),
    );
  }

  it('keeps the recorded policy decision apart from the current intervention status', async () => {
    loadReleasedHold();
    const { host } = await render();
    expect(text(host.querySelector('sentinel-case-detail .box.policy'))).toContain('HOLD');
    expect(text(host.querySelector('sentinel-case-detail .box.policy'))).not.toContain('RELEASED');
    expect(text(host.querySelector('sentinel-case-detail .box.status'))).toContain('RELEASED');
    expect(text(host.querySelector('sentinel-case-detail .box.status'))).toContain('by SYSTEM');
  });

  it('shows four figures from the store, directly below the heading', async () => {
    loadReleasedHold();
    const { host } = await render();
    const metrics = [...host.querySelectorAll('.metrics .metric')].map((metric) => text(metric));
    expect(metrics).toHaveLength(4);
    expect(metrics[0]).toMatch(/Open alerts\s*2/);
    expect(metrics[1]).toContain('95');
    expect(metrics[2]).toContain('%');
    expect(metrics[3]).toMatch(/Active held transfers\s*0/);
  });

  it('lists alerts that share a display reference as distinct entries, each with its own account token', async () => {
    loadReleasedHold();
    const { host } = await render();
    const entries = [...host.querySelectorAll('sentinel-alert-queue li')].map((entry) => text(entry));
    expect(entries).toHaveLength(2);
    expect(entries[1]).toContain('acct_tok_run2');
    expect(text(host.querySelector('sentinel-alert-queue header'))).toContain('2 entries');
  });

  it('opens the decision trace in a dialog and closes it with Escape', async () => {
    loadReleasedHold();
    const { host, settle } = await render();
    (host.querySelector('sentinel-case-detail footer button.secondary') as HTMLButtonElement).click();
    await settle();
    expect(text(host.querySelector('.dialog'))).toContain('Deterministic policy gate');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(host.querySelector('.dialog')).toBeNull();
  });
});
