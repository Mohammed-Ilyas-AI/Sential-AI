import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideTestStore } from '../../../../testing/provide-test-store';
import { demoFinalDecision, demoHold, demoThirdDecision } from '../../../../testing/ui-fixtures';
import { CoreApiClient } from '../../../core/http/api-client/core-api-client';
import { InterventionsActions } from '../../../state/interventions/interventions.actions';
import { TransactionsActions } from '../../../state/transactions/transactions.actions';
import { InterventionsFacade } from './interventions-facade';

describe('InterventionsFacade', () => {
  const post = vi.fn();

  beforeEach(() => {
    post.mockReset();
    TestBed.configureTestingModule({ providers: [provideTestStore(), provideRouter([]), { provide: CoreApiClient, useValue: { post } }, InterventionsFacade] });
    const store = TestBed.inject(Store);
    store.dispatch(TransactionsActions.snapshotLoaded({ decisions: [demoThirdDecision(), demoFinalDecision()], cursor: 'cursor-1' }));
    store.dispatch(InterventionsActions.snapshotLoaded({ interventions: [demoHold()] }));
  });

  it('lists each intervened transfer with its recorded decision and its current state as separate facts', () => {
    const facade = TestBed.inject(InterventionsFacade);
    expect(facade.rows()).toHaveLength(1);
    expect(facade.rows()[0]).toMatchObject({ state: 'HELD', kind: 'THRESHOLD', decided: { decision: 'HOLD', score: 95 } });
    expect(facade.kpis()).toMatchObject({ total: 1, held: 1, released: 0, closed: 0 });

    TestBed.inject(Store).dispatch(
      InterventionsActions.interventionAppended({ intervention: demoHold({ id: 'int_demo_2', previousState: 'HELD', state: 'RELEASED', actor: 'CUSTOMER' }) }),
    );
    expect(facade.rows()[0]).toMatchObject({ state: 'RELEASED', actor: 'CUSTOMER', decided: { decision: 'HOLD' } });
    expect(facade.rows()[0]?.history.map((record) => record.state)).toEqual(['HELD', 'RELEASED']);
  });

  it('records an exception through sentinel-core and shows it only once the server returns the record', () => {
    const facade = TestBed.inject(InterventionsFacade);
    const transactionId = facade.rows()[0]!.transactionId;
    post.mockReturnValue(of(demoHold({ id: 'int_demo_3', previousState: 'HELD', state: 'RELEASED', actor: 'CUSTOMER' })));
    facade.act('customer-verified-release', transactionId);
    expect(post).toHaveBeenCalledWith(`/v1/interventions/${transactionId}/customer-verified-release`, {});
    expect(facade.rows()[0]?.state).toBe('RELEASED');
    expect(facade.pendingAction()).toBeNull();
  });

  it('sends the analyst identity with a fraud confirmation, and leaves the hold as it was when refused', () => {
    const facade = TestBed.inject(InterventionsFacade);
    const transactionId = facade.rows()[0]!.transactionId;
    facade.select(transactionId);
    post.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    facade.act('fraud-confirmation', transactionId);
    expect(post).toHaveBeenCalledWith(`/v1/interventions/${transactionId}/fraud-confirmation`, { analystIdentity: 'demo-analyst' });
    expect(facade.rows()[0]?.state).toBe('HELD');
    expect(facade.actionFailure()).toContain('already moved');
  });

  it('filters, sorts and pages the real rows, returning to the first page on every change', () => {
    const facade = TestBed.inject(InterventionsFacade);
    facade.page.set(4);
    facade.setFilter('state', 'RELEASED');
    expect(facade.filtered()).toHaveLength(0);
    expect(facade.page()).toBe(1);
    facade.clearFilters();
    facade.setFilter('query', facade.rows()[0]!.transactionId.slice(-6));
    expect(facade.filtered()).toHaveLength(1);
    facade.sortBy('heldAt');
    expect(facade.sort()).toEqual({ key: 'heldAt', direction: 'asc' });
  });
});
