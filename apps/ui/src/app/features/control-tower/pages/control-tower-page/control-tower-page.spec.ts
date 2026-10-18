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
import { ThemePreferences } from '../../../../core/theme/theme-preferences';
import { ControlTowerFacade } from '../../data-access/control-tower-facade';
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

  it('composes exactly the approved surfaces, and nothing for searching or operating', async () => {
    const host = await render();
    for (const selector of [
      'sentinel-kpi-card',
      'sentinel-live-global-network',
      'sentinel-operations-globe',
      'sentinel-needs-attention',
      'sentinel-transaction-stream',
      'sentinel-system-status',
    ]) {
      expect(host.querySelector(selector), selector).not.toBeNull();
    }
    // Their detail belongs on dedicated pages, not repeated on the dashboard.
    expect(host.querySelector('sentinel-risk-analysis, sentinel-threat-landscape, sentinel-policy-gate')).toBeNull();
    expect(host.querySelectorAll('sentinel-kpi-card')).toHaveLength(4);
    expect(host.querySelector('input:not([type="checkbox"]), [role="search"], [role="combobox"]')).toBeNull();
    expect(host.querySelector('sentinel-transaction-tape, sentinel-alert-queue, sentinel-policy-hold')).toBeNull();
  });

  it('pans the map from the keyboard without pausing it; only the explicit control pauses and resumes', async () => {
    const fixture = TestBed.createComponent(ControlTowerPage);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const toggle = () => host.querySelector<HTMLButtonElement>('sentinel-live-global-network .controls button[aria-pressed]');
    expect(toggle()?.getAttribute('aria-pressed')).toBe('true');
    expect(toggle()?.getAttribute('title')).toBe('Pause animation');

    const map = host.querySelector('sentinel-operations-globe') as HTMLElement;
    expect(map.getAttribute('tabindex')).toBe('0');
    expect(map.getAttribute('aria-label')).toContain('arrow keys');
    map.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await fixture.whenStable();
    expect(toggle()?.getAttribute('aria-pressed')).toBe('true');

    toggle()?.click();
    await fixture.whenStable();
    expect(toggle()?.getAttribute('aria-pressed')).toBe('false');
    expect(toggle()?.getAttribute('title')).toBe('Resume animation');

    toggle()?.click();
    await fixture.whenStable();
    expect(toggle()?.getAttribute('aria-pressed')).toBe('true');
  });

  it('clears bank and transaction focus from the popup close and the global reset control', async () => {
    loadDemoHold();
    const fixture = TestBed.createComponent(ControlTowerPage);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const facade = TestBed.inject(ControlTowerFacade);
    const theme = TestBed.inject(ThemePreferences);
    const appearance = theme.appearance();
    const savedBrand = theme.savedBrand();
    const selectBankThenTransaction = () => {
      facade.select({ kind: 'bank', id: 'BANK_A' });
      facade.select({ kind: 'bank', id: 'BANK_B' });
      facade.select({ kind: 'transaction', id: 'txn_demo_final' });
      fixture.detectChanges();
    };

    selectBankThenTransaction();
    expect(facade.bankFocus()).toBe('BANK_B');
    expect(facade.globeSelection()).toEqual({ kind: 'transaction', id: 'txn_demo_final' });
    host.querySelector<HTMLButtonElement>('sentinel-globe-detail button[aria-label="Reset global view"]')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(facade.bankFocus()).toBeNull();
    expect(facade.globeSelection()).toBeNull();
    expect(host.querySelector('.focus-chip')).toBeNull();
    expect(host.querySelector('sentinel-globe-detail')).toBeNull();

    selectBankThenTransaction();
    host.querySelector<HTMLButtonElement>('.controls button[aria-label="Reset map position"]')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(facade.bankFocus()).toBeNull();
    expect(facade.globeSelection()).toBeNull();
    expect(host.querySelector('.focus-chip')).toBeNull();
    expect(host.querySelector('sentinel-globe-detail')).toBeNull();
    expect(TestBed.inject(ThemePreferences).appearance()).toBe(appearance);
    expect(theme.savedBrand()).toBe(savedBrand);
  });

  it('hides transaction callouts without removing the globe selection surface', async () => {
    loadDemoHold();
    const fixture = TestBed.createComponent(ControlTowerPage);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('sentinel-operations-globe .callout')).not.toBeNull();
    const transactionLabels = host.querySelectorAll<HTMLInputElement>('.layer-menu input')[1];
    transactionLabels?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.querySelector('sentinel-operations-globe .callout')).toBeNull();
    expect(host.querySelector('sentinel-operations-globe canvas')).not.toBeNull();
  });

  it('shows DEMO_TAKEOVER_01 held across the tower', async () => {
    loadDemoHold();
    const host = await render();

    expect(textOf(host, 'h1')).toBe('Control Tower');
    const kpi = (index: number) => ({
      label: textOf(host, `sentinel-kpi-card:nth-child(${index + 1}) .label`),
      value: textOf(host, `sentinel-kpi-card:nth-child(${index + 1}) .value`),
    });
    expect([0, 1, 2, 3].map(kpi)).toEqual([
      { label: 'Live Transactions', value: '2' },
      { label: 'High Risk Alerts', value: '1' },
      { label: 'Active Holds', value: '1' },
      { label: 'Monitored Banks', value: '3' },
    ]);

    const firstRow = textOf(host, 'sentinel-transaction-stream tbody tr');
    expect(firstRow).toContain('S$11,500.00');
    expect(firstRow).toContain('Bank A → Bank C');
    expect(firstRow).toContain('95');
    expect(firstRow).toContain('HOLD');

    const callout = textOf(host, 'sentinel-operations-globe .callout[data-tone="held"]');
    expect(callout).toContain('S$11,500.00');
    expect(callout).toContain('HOLD');

    const attention = textOf(host, 'sentinel-needs-attention li');
    expect(attention).toContain('Bank A → Bank C');
    expect(attention).toContain('S$11,500.00');
    expect(attention).toContain('HOLD');

    expect(textOf(host, 'sentinel-system-status')).toContain('Control path operational');
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
    // The recorded decision stays HOLD; the alert shows the current intervention state.
    expect(textOf(host, 'sentinel-needs-attention li')).toContain('RELEASED');
    expect(textOf(host, 'sentinel-kpi-card:nth-child(3) .value')).toBe('0');
  });
});
