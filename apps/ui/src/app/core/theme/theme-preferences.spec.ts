import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { take } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideTestStore } from '../../../testing/provide-test-store';
import { demoAlert, demoFinalDecision, demoHold } from '../../../testing/ui-fixtures';
import { AlertsActions } from '../../state/alerts/alerts.actions';
import { InterventionsActions } from '../../state/interventions/interventions.actions';
import { TransactionsActions } from '../../state/transactions/transactions.actions';
import { APPEARANCE_PREFERENCE_KEY, BRAND_PREFERENCE_KEY, ThemePreferences } from './theme-preferences';

describe('ThemePreferences', () => {
  const root = () => document.documentElement;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTestStore()] });
  });

  afterEach(() => {
    root().removeAttribute('data-tenant-theme');
    root().removeAttribute('data-appearance');
  });

  it('opens a first visit in the SENTINEL AI light theme', () => {
    const theme = TestBed.inject(ThemePreferences);
    expect([theme.brand(), theme.appearance()]).toEqual(['sentinel', 'light']);
    expect(root().hasAttribute('data-tenant-theme')).toBe(false);
    expect(root().getAttribute('data-appearance')).toBe('light');
    expect(localStorage.getItem(APPEARANCE_PREFERENCE_KEY)).toBeNull();
  });

  it('keeps a returning visitor in the dark theme they chose', () => {
    localStorage.setItem(APPEARANCE_PREFERENCE_KEY, 'dark');
    const theme = TestBed.inject(ThemePreferences);
    expect(theme.appearance()).toBe('dark');
    expect(root().hasAttribute('data-appearance')).toBe(false);
  });

  it('keeps the two controls independent', () => {
    const theme = TestBed.inject(ThemePreferences);
    theme.selectAppearance('dark');
    theme.selectBrand('bank-a');
    expect(root().getAttribute('data-tenant-theme')).toBe('bank-a');
    expect(root().hasAttribute('data-appearance')).toBe(false);

    theme.selectAppearance('light');
    expect(root().getAttribute('data-tenant-theme')).toBe('bank-a');
    expect(root().getAttribute('data-appearance')).toBe('light');

    theme.selectBrand('sentinel');
    expect(root().hasAttribute('data-tenant-theme')).toBe(false);
    expect(root().getAttribute('data-appearance')).toBe('light');
  });

  it('remembers both choices, so a reload or another route keeps the theme', () => {
    TestBed.inject(ThemePreferences).selectBrand('bank-c');
    TestBed.inject(ThemePreferences).selectAppearance('light');
    expect([localStorage.getItem(BRAND_PREFERENCE_KEY), localStorage.getItem(APPEARANCE_PREFERENCE_KEY)]).toEqual(['bank-c', 'light']);

    TestBed.resetTestingModule();
    root().removeAttribute('data-tenant-theme');
    root().removeAttribute('data-appearance');
    TestBed.configureTestingModule({ providers: [provideTestStore()] });
    const restored = TestBed.inject(ThemePreferences);
    expect([restored.brand(), restored.appearance()]).toEqual(['bank-c', 'light']);
    expect(root().getAttribute('data-tenant-theme')).toBe('bank-c');
  });

  it('ignores a tampered stored value and falls back to the baseline', () => {
    localStorage.setItem(BRAND_PREFERENCE_KEY, 'real-bank');
    localStorage.setItem(APPEARANCE_PREFERENCE_KEY, 'neon');
    const theme = TestBed.inject(ThemePreferences);
    expect([theme.brand(), theme.appearance()]).toEqual(['sentinel', 'light']);
  });

  it('remembers a switch to dark across a reload', () => {
    TestBed.inject(ThemePreferences).selectAppearance('dark');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideTestStore()] });
    expect(TestBed.inject(ThemePreferences).appearance()).toBe('dark');
  });

  it('changes presentation only: the decisions, scores, alerts and holds in the store are untouched', () => {
    const store = TestBed.inject(Store);
    store.dispatch(TransactionsActions.snapshotLoaded({ decisions: [demoFinalDecision()], cursor: 'c1' }));
    store.dispatch(AlertsActions.snapshotLoaded({ alerts: [demoAlert()] }));
    store.dispatch(InterventionsActions.snapshotLoaded({ interventions: [demoHold()] }));
    const snapshot = () => {
      let state: unknown;
      store.pipe(take(1)).subscribe((value) => (state = value));
      return JSON.stringify(state);
    };
    const before = snapshot();

    const theme = TestBed.inject(ThemePreferences);
    for (const brand of ['bank-a', 'bank-b', 'bank-c', 'sentinel'] as const) {
      theme.selectBrand(brand);
      theme.selectAppearance('light');
      theme.selectAppearance('dark');
    }
    expect(snapshot()).toBe(before);
  });
});
