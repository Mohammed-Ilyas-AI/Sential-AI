import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import type { AuditEvent as RecordedAction } from '@sentinel/domain';
import { NEVER, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreApiClient } from '../../../core/http/api-client/core-api-client';
import { provideTestStore } from '../../../../testing/provide-test-store';
import { demoAlert, demoFinalDecision, demoHold, demoThirdDecision } from '../../../../testing/ui-fixtures';
import { AlertsActions } from '../../../state/alerts/alerts.actions';
import { InterventionsActions } from '../../../state/interventions/interventions.actions';
import { TransactionsActions } from '../../../state/transactions/transactions.actions';
import { AuditLogsFacade } from './audit-logs-facade';

describe('AuditLogsFacade', () => {
  const get = vi.fn();

  beforeEach(() => {
    get.mockReset();
    get.mockReturnValue(NEVER);
    TestBed.configureTestingModule({ providers: [provideTestStore(), provideRouter([]), { provide: CoreApiClient, useValue: { get } }, AuditLogsFacade] });
    const store = TestBed.inject(Store);
    store.dispatch(TransactionsActions.snapshotLoaded({ decisions: [demoThirdDecision(), demoFinalDecision()], cursor: 'cursor-1' }));
    store.dispatch(InterventionsActions.snapshotLoaded({ interventions: [demoHold()] }));
    store.dispatch(AlertsActions.snapshotLoaded({ alerts: [demoAlert()] }));
  });

  it('merges recorded decisions, intervention transitions and alerts without altering their timestamps', () => {
    const facade = TestBed.inject(AuditLogsFacade);
    const events = facade.events();
    expect(events.map((event) => event.category).sort()).toEqual(['ALERT', 'DECISION', 'DECISION', 'INTERVENTION']);
    const hold = events.find((event) => event.category === 'INTERVENTION')!;
    expect(hold).toMatchObject({ result: 'HELD', severity: 'WARNING', at: demoHold().actedAt });
    expect(facade.kpis()).toMatchObject({ total: 4, interventions: 1 });
  });

  it('records the analyst identity on an analyst transition', () => {
    const facade = TestBed.inject(AuditLogsFacade);
    TestBed.inject(Store).dispatch(
      InterventionsActions.interventionAppended({
        intervention: demoHold({ id: 'int_demo_2', previousState: 'HELD', state: 'REJECTED', actor: 'ANALYST', actorIdentity: 'demo-analyst' }),
      }),
    );
    const rejected = facade.events().find((event) => event.result === 'REJECTED')!;
    expect(rejected).toMatchObject({ actorKind: 'ANALYST', actor: 'demo-analyst', action: 'HELD → REJECTED', severity: 'CRITICAL' });
    expect(facade.kpis().analyst).toBe(1);
  });

  it('filters, sorts and pages together, returning to the first page on each filter change', () => {
    const facade = TestBed.inject(AuditLogsFacade);
    facade.page.set(3);
    facade.setFilter('category', 'DECISION');
    expect(facade.page()).toBe(0);
    expect(facade.filtered()).toHaveLength(2);
    expect(facade.filtered()[0]!.at >= facade.filtered()[1]!.at).toBe(true);
    facade.sortBy('at');
    expect(facade.filtered()[0]!.at <= facade.filtered()[1]!.at).toBe(true);
    facade.resetFilters();
    facade.setFilter('query', demoHold().transactionId);
    expect(facade.filtered().every((event) => event.transactionId === demoHold().transactionId)).toBe(true);
  });

  it('exports the filtered trail with the stored UTC timestamps', () => {
    const facade = TestBed.inject(AuditLogsFacade);
    facade.setFilter('category', 'INTERVENTION');
    const lines = facade.exportCsv().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(`"${demoHold().actedAt}"`);
  });

  it('adds the actions sentinel-core recorded, as stored, and says when they are unavailable', () => {
    const recorded: RecordedAction = {
      id: 'evt-1',
      category: 'KILL_SWITCH',
      action: 'KILL_SWITCH_ACTIVATED',
      outcome: 'SUCCEEDED',
      actor: 'ANALYST',
      actorIdentity: 'analyst.tan',
      occurredAt: '2026-09-24T12:00:00.000Z',
      traceId: 'trace-1',
      subject: { institutionId: 'BANK_A', accountId: demoHold().accountId },
    };
    get.mockReturnValue(of({ events: [recorded] }));
    const facade = TestBed.inject(AuditLogsFacade);
    TestBed.tick();
    const action = facade.events().find((event) => event.category === 'ACTION');
    expect(action).toMatchObject({ at: recorded.occurredAt, actor: 'analyst.tan', module: 'Account controls', result: 'SUCCEEDED', severity: 'WARNING' });
    expect(get).toHaveBeenCalledWith('/v1/audit-events?limit=500');

    get.mockReturnValue(throwError(() => new Error('down')));
    facade.loadRecorded();
    expect(facade.recordedStatus()).toBe('UNAVAILABLE');
    expect(facade.events().some((event) => event.category === 'ACTION')).toBe(false);
  });
});
