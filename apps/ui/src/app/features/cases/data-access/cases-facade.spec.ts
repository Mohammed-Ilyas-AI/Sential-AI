import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import type { Case, CaseReport, CaseReportVersion } from '@sentinel/domain';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideTestStore } from '../../../../testing/provide-test-store';
import { demoAlert } from '../../../../testing/ui-fixtures';
import { CoreApiClient } from '../../../core/http/api-client/core-api-client';
import { AlertsActions } from '../../../state/alerts/alerts.actions';
import { CasesFacade } from './cases-facade';

const caseFile = { id: 'case-1', accountId: 'acct_1', institutionId: 'BANK_A', alertIds: ['alert-other'], status: 'OPEN' } as unknown as Case;
const draft = {
  reportId: 'r-1',
  caseId: 'case-1',
  version: 1,
  revision: 1,
  status: 'DRAFT',
  sections: [{ id: 'RECOMMENDATION', title: 'Recommendation', body: '[Analyst to complete before sign-off]', sources: [], edited: false }],
  updatedAt: '2026-09-24T12:00:00.000Z',
  updatedBy: 'demo-analyst',
} as unknown as CaseReportVersion;
const report: CaseReport = { caseId: 'case-1', latest: draft, versions: [{ version: 1, status: 'DRAFT', updatedAt: draft.updatedAt, updatedBy: 'demo-analyst' }] };

describe('CasesFacade', () => {
  const get = vi.fn();
  const post = vi.fn();
  const patch = vi.fn();

  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    patch.mockReset();
    get.mockImplementation((path: string) => (path.startsWith('/v1/cases?') ? of({ cases: [caseFile] }) : of(report)));
    TestBed.configureTestingModule({
      providers: [provideTestStore(), provideRouter([]), { provide: CoreApiClient, useValue: { get, post, patch, getBlob: vi.fn() } }, CasesFacade],
    });
    TestBed.inject(Store).dispatch(AlertsActions.snapshotLoaded({ alerts: [demoAlert()] }));
  });

  it('loads the cases, selects the first and its stored report, and offers alerts that have no case', () => {
    const facade = TestBed.inject(CasesFacade);
    TestBed.tick();
    expect(facade.selected()?.id).toBe('case-1');
    expect(facade.latest()?.status).toBe('DRAFT');
    expect(facade.openable().map((alert) => alert.id)).toEqual([demoAlert().id]);
  });

  it('saves only changed sections against the revision it read, and shows what the server stored', () => {
    const facade = TestBed.inject(CasesFacade);
    TestBed.tick();
    facade.edit('RECOMMENDATION', 'Escalate.');
    expect(facade.dirty()).toBe(true);
    patch.mockReturnValue(of({ ...draft, revision: 2, sections: [{ ...draft.sections[0], body: 'Escalate.', edited: true }] }));
    facade.saveDraft();
    expect(patch).toHaveBeenCalledWith('/v1/cases/case-1/report/1', { analystIdentity: 'demo-analyst', expectedRevision: 1, edits: [{ id: 'RECOMMENDATION', body: 'Escalate.' }] });
    expect(facade.latest()?.revision).toBe(2);
    expect(facade.dirty()).toBe(false);
  });

  it('will not sign off unsaved edits, and shows the server reason when a sign-off is refused', () => {
    const facade = TestBed.inject(CasesFacade);
    TestBed.tick();
    facade.edit('RECOMMENDATION', 'Unsaved.');
    facade.signOff();
    expect(post).not.toHaveBeenCalled();
    facade.discardEdits();
    post.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { detail: 'Write the analyst recommendation before signing off' } })));
    facade.signOff();
    expect(facade.actionError()).toBe('Write the analyst recommendation before signing off');
    expect(facade.latest()?.status).toBe('DRAFT');
  });

  it('explains a lens refusal instead of showing an empty list', () => {
    get.mockImplementation(() => throwError(() => new HttpErrorResponse({ status: 403 })));
    const facade = TestBed.inject(CasesFacade);
    TestBed.tick();
    expect(facade.listStatus()).toBe('ERROR');
    expect(facade.listError()).toContain('another institution');
  });
});
