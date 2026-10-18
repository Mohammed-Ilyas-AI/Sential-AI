import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideTestStore } from '../../../../testing/provide-test-store';
import { demoFinalDecision, demoThirdDecision } from '../../../../testing/ui-fixtures';
import { LOCAL_RUNTIME_CONFIG, RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { CoreApiClient } from '../../../core/http/api-client/core-api-client';
import { TransactionsActions } from '../../../state/transactions/transactions.actions';
import { IntegrationsFacade } from './integrations-facade';

describe('IntegrationsFacade', () => {
  const get = vi.fn();

  beforeEach(() => {
    get.mockReset();
    TestBed.configureTestingModule({
      providers: [provideTestStore(), provideRouter([]), { provide: CoreApiClient, useValue: { get } }, { provide: RUNTIME_CONFIG, useValue: LOCAL_RUNTIME_CONFIG }, IntegrationsFacade],
    });
    TestBed.inject(Store).dispatch(TransactionsActions.snapshotLoaded({ decisions: [demoThirdDecision(), demoFinalDecision()], cursor: 'cursor-1' }));
  });

  it('lists one connector per institution seen on the tape, plus the platform services, without assuming health', () => {
    get.mockReturnValue(of({ status: 'ok', uptimeSeconds: 120 }));
    const facade = TestBed.inject(IntegrationsFacade);
    const banks = facade.connectors().filter((connector) => connector.category === 'Banking');
    expect(banks.length).toBeGreaterThan(0);
    expect(facade.connectors().find((connector) => connector.id === 'vertex')?.status).toBe('UNOBSERVABLE');
    expect(facade.connectors().find((connector) => connector.id === 'core')?.status).toBe('HEALTHY');
    expect(facade.kpis().decisions).toBe(2);
  });

  it('marks every credential as secret and never carries a secret value', () => {
    get.mockReturnValue(of({ status: 'ok' }));
    const secrets = TestBed.inject(IntegrationsFacade)
      .connectors()
      .flatMap((connector) => connector.configuration)
      .filter((fact) => /credential|connection string|api key|password/i.test(fact.label));
    expect(secrets.length).toBeGreaterThan(0);
    expect(secrets.every((fact) => fact.secret)).toBe(true);
  });

  it('treats a JSON 404 from the service as reachable and a network failure as unavailable', () => {
    get.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 404 })));
    get.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 404, error: { error: 'not_found' } })));
    const facade = TestBed.inject(IntegrationsFacade);
    expect(facade.lastProbe()).toMatchObject({ ok: true });

    get.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));
    get.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));
    facade.refresh();
    expect(facade.lastProbe()).toMatchObject({ ok: false });
    expect(facade.connectors().find((connector) => connector.id === 'core')?.status).toBe('UNAVAILABLE');
  });

  it('filters by category, status and search over the real connectors', () => {
    get.mockReturnValue(of({ status: 'ok' }));
    const facade = TestBed.inject(IntegrationsFacade);
    facade.category.set('AI');
    expect(facade.visible().map((connector) => connector.id)).toEqual(['vertex']);
    facade.category.set('ALL');
    facade.query.set('no such connector');
    expect(facade.visible()).toHaveLength(0);
  });
});
