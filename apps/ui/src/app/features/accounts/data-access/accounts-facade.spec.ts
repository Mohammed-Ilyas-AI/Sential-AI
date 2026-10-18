import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { NEVER } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideTestStore } from '../../../../testing/provide-test-store';
import { CoreApiClient } from '../../../core/http/api-client/core-api-client';
import { demoAlert, demoFinalDecision, demoHold, demoThirdDecision } from '../../../../testing/ui-fixtures';
import { AlertsActions } from '../../../state/alerts/alerts.actions';
import { InterventionsActions } from '../../../state/interventions/interventions.actions';
import { TransactionsActions } from '../../../state/transactions/transactions.actions';
import { AccountsFacade } from './accounts-facade';

describe('AccountsFacade', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTestStore(), provideRouter([]), { provide: CoreApiClient, useValue: { get: () => NEVER } }, AccountsFacade] });
    const store = TestBed.inject(Store);
    store.dispatch(TransactionsActions.snapshotLoaded({ decisions: [demoThirdDecision(), demoFinalDecision()], cursor: 'cursor-1' }));
    store.dispatch(AlertsActions.snapshotLoaded({ alerts: [demoAlert()] }));
    store.dispatch(InterventionsActions.snapshotLoaded({ interventions: [demoHold()] }));
  });

  it('lists each scored account once, from its latest decision, with risk, decision and status kept apart', () => {
    const facade = TestBed.inject(AccountsFacade);
    const [row] = facade.accounts();
    expect(facade.accounts()).toHaveLength(1);
    expect(row).toMatchObject({ accountId: demoFinalDecision().accountId, score: 95, decision: 'HOLD', status: 'ON HOLD', intervention: 'HELD' });
    expect(facade.kpis()).toEqual({ total: 1, highRisk: 1, review: 1, onHold: 1, normal: 0 });
  });

  it('shows a released hold as released while the recorded decision stays HOLD', () => {
    TestBed.inject(Store).dispatch(
      InterventionsActions.interventionAppended({ intervention: demoHold({ id: 'int_demo_2', previousState: 'HELD', state: 'RELEASED', actor: 'CUSTOMER' }) }),
    );
    const facade = TestBed.inject(AccountsFacade);
    expect(facade.accounts()[0]).toMatchObject({ decision: 'HOLD', intervention: 'RELEASED', status: 'ALERT OPEN' });
  });

  it('filters and searches the real rows, returning to the first page on every change', () => {
    const facade = TestBed.inject(AccountsFacade);
    facade.page.set(3);
    facade.setFilter('band', 'LOW');
    expect(facade.filtered()).toHaveLength(0);
    expect(facade.page()).toBe(1);
    facade.clearFilters();
    facade.setFilter('query', demoFinalDecision().accountId.slice(-6));
    expect(facade.filtered()).toHaveLength(1);
    facade.setFilter('query', 'no-such-account');
    expect(facade.filtered()).toHaveLength(0);
  });

  it('toggles the sort direction on the same column and exports what is filtered', () => {
    const facade = TestBed.inject(AccountsFacade);
    facade.sortBy('score');
    expect(facade.sort()).toEqual({ key: 'score', direction: 'asc' });
    facade.sortBy('reference');
    expect(facade.sort()).toEqual({ key: 'reference', direction: 'asc' });
    const csv = facade.exportCsv().split('\r\n');
    expect(csv).toHaveLength(2);
    expect(csv[1]).toContain('"HOLD"');
  });
});
