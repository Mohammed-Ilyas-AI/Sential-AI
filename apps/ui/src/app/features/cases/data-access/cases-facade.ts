import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import type { Case, CaseReport, CaseReportSectionId, CaseReportVersion } from '@sentinel/domain';
import { finalize, type Observable } from 'rxjs';
import { CoreApiClient } from '../../../core/http/api-client/core-api-client';
import { TenantLensPreference } from '../../../core/tenancy/tenant-lens';
import { alertsFeature } from '../../../state/alerts/alerts.feature';
import { sessionFeature } from '../../../state/session/session.feature';

export type LoadStatus = 'IDLE' | 'LOADING' | 'READY' | 'ERROR';
export type ReportStatus = 'IDLE' | 'LOADING' | 'NONE' | 'READY' | 'ERROR';
export type CaseAction = 'OPEN' | 'ESCALATE' | 'GENERATE' | 'SAVE' | 'SIGN_OFF' | 'REVISE' | 'EXPORT';

interface Written<TRecord> {
  readonly outcome: 'CREATED' | 'DUPLICATE';
  readonly record: TRecord;
}

/** What the analyst should read when sentinel-core refuses: its own detail, or the reason it could not answer. */
export function failureMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return 'The request could not be completed.';
  if (error.status === 0) return 'sentinel-core is unreachable; nothing was saved.';
  if (error.status === 403) return 'This case belongs to another institution and is not available under the current data lens.';
  const detail = typeof error.error === 'object' && error.error !== null && 'detail' in error.error ? String((error.error as { detail: unknown }).detail) : null;
  if (detail) return detail;
  if (error.status === 404) return 'Not found.';
  return `sentinel-core refused the request (HTTP ${error.status}).`;
}

/**
 * Cases and the one-click case report (M§5.6), route-scoped. Every change goes to sentinel-core and the page shows
 * what the server stored: the draft as saved, the signed version as signed, the PDF as rendered.
 */
@Injectable()
export class CasesFacade {
  private readonly api = inject(CoreApiClient);
  private readonly store = inject(Store);
  private readonly lens = inject(TenantLensPreference).lens;
  private readonly analyst = this.store.selectSignal(sessionFeature.selectAnalystIdentity);
  private readonly openAlerts = this.store.selectSignal(alertsFeature.selectQueue);

  private readonly casesState = signal<{ readonly status: LoadStatus; readonly cases: readonly Case[]; readonly error: string | null }>({
    status: 'IDLE',
    cases: [],
    error: null,
  });
  readonly cases = computed(() => this.casesState().cases);
  readonly listStatus = computed(() => this.casesState().status);
  readonly listError = computed(() => this.casesState().error);

  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(() => this.cases().find((candidate) => candidate.id === this.selectedId()) ?? null);

  /** Open alerts with no case yet: the "Investigate alert" entry point. */
  readonly openable = computed(() => {
    const opened = new Set(this.cases().flatMap((candidate) => candidate.alertIds));
    return this.openAlerts().filter((alert) => !opened.has(alert.id));
  });

  private readonly reportState = signal<{ readonly status: ReportStatus; readonly report: CaseReport | null }>({ status: 'IDLE', report: null });
  readonly report = computed(() => this.reportState().report);
  readonly reportStatus = computed(() => this.reportState().status);
  readonly latest = computed<CaseReportVersion | null>(() => this.report()?.latest ?? null);

  /** Unsaved text per section of the current draft. */
  readonly edits = signal<Partial<Record<CaseReportSectionId, string>>>({});
  readonly dirty = computed(() => {
    const latest = this.latest();
    const edits = this.edits();
    return !!latest && latest.sections.some((section) => edits[section.id] !== undefined && edits[section.id] !== section.body);
  });

  readonly busy = signal<CaseAction | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  constructor() {
    const requested = inject(ActivatedRoute).snapshot.queryParamMap.get('case');
    if (requested) this.selectedId.set(requested);
    // The data lens changes what the server may return: reload everything when it changes.
    effect(() => {
      void this.lens();
      untracked(() => this.refresh());
    });
    effect(() => {
      const id = this.selectedId();
      untracked(() => this.loadReport(id));
    });
  }

  refresh(): void {
    this.casesState.update((state) => ({ ...state, status: 'LOADING', error: null }));
    this.api.get<{ cases: readonly Case[] }>('/v1/cases?limit=100').subscribe({
      next: ({ cases }) => {
        this.casesState.set({ status: 'READY', cases, error: null });
        if (!this.selectedId() || !cases.some((candidate) => candidate.id === this.selectedId())) this.selectedId.set(cases[0]?.id ?? null);
      },
      error: (error: unknown) => this.casesState.set({ status: 'ERROR', cases: [], error: failureMessage(error) }),
    });
  }

  select(caseId: string): void {
    if (this.selectedId() !== caseId) this.selectedId.set(caseId);
  }

  openCase(alertId: string): void {
    this.run('OPEN', this.api.post<Written<Case>>('/v1/cases', { alertId, analystIdentity: this.analyst() }), (written) => {
      this.casesState.update((state) => ({ ...state, cases: [written.record, ...state.cases.filter((candidate) => candidate.id !== written.record.id)] }));
      this.selectedId.set(written.record.id);
      this.notice.set(written.outcome === 'CREATED' ? 'Case opened from the alert with its evidence bundle.' : 'This alert already had a case; it is now selected.');
    });
  }

  escalate(): void {
    const selected = this.selected();
    if (!selected) return;
    this.run('ESCALATE', this.api.post<Case>(`/v1/cases/${selected.id}/escalate`, { analystIdentity: this.analyst() }), (updated) => {
      this.casesState.update((state) => ({ ...state, cases: state.cases.map((candidate) => (candidate.id === updated.id ? updated : candidate)) }));
      this.notice.set('Case escalated.');
    });
  }

  generateReport(): void {
    const selected = this.selected();
    if (!selected) return;
    this.run('GENERATE', this.api.post<Written<CaseReport>>(`/v1/cases/${selected.id}/report`, { analystIdentity: this.analyst() }), (written) => {
      this.setReport(written.record);
      this.notice.set(written.outcome === 'CREATED' ? 'Draft generated from the recorded evidence.' : 'A report already existed; showing it.');
    });
  }

  edit(section: CaseReportSectionId, body: string): void {
    this.edits.update((edits) => ({ ...edits, [section]: body }));
  }

  discardEdits(): void {
    this.edits.set({});
  }

  saveDraft(): void {
    const selected = this.selected();
    const latest = this.latest();
    if (!selected || !latest || latest.status !== 'DRAFT') return;
    const edits = this.changedSections(latest);
    if (edits.length === 0) return;
    this.run(
      'SAVE',
      this.api.patch<CaseReportVersion>(`/v1/cases/${selected.id}/report/${latest.version}`, { analystIdentity: this.analyst(), expectedRevision: latest.revision, edits }),
      (saved) => {
        this.replaceLatest(saved);
        this.edits.set({});
        this.notice.set(`Draft saved (revision ${saved.revision}).`);
      },
    );
  }

  signOff(): void {
    const selected = this.selected();
    const latest = this.latest();
    if (!selected || !latest || latest.status !== 'DRAFT' || this.dirty()) return;
    this.run(
      'SIGN_OFF',
      this.api.post<CaseReportVersion>(`/v1/cases/${selected.id}/report/${latest.version}/sign-off`, { analystIdentity: this.analyst(), expectedRevision: latest.revision }),
      (signed) => {
        this.replaceLatest(signed);
        this.notice.set(`Version ${signed.version} signed off by ${signed.signedOffBy ?? ''}. It can no longer change.`);
      },
    );
  }

  startRevision(): void {
    const selected = this.selected();
    const latest = this.latest();
    if (!selected || !latest || latest.status !== 'SIGNED_OFF') return;
    this.run(
      'REVISE',
      this.api.post<CaseReportVersion>(`/v1/cases/${selected.id}/report/revision`, { analystIdentity: this.analyst(), fromVersion: latest.version }),
      () => {
        this.loadReport(selected.id);
        this.notice.set(`Version ${latest.version + 1} started as a draft; version ${latest.version} stays signed.`);
      },
    );
  }

  exportPdf(): void {
    const selected = this.selected();
    const latest = this.latest();
    if (!selected || !latest) return;
    this.run('EXPORT', this.api.getBlob(`/v1/cases/${selected.id}/report/${latest.version}/export`), (blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `case-${selected.id}-report-v${latest.version}${latest.status === 'DRAFT' ? '-draft' : ''}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  private changedSections(latest: CaseReportVersion): { id: CaseReportSectionId; body: string }[] {
    const edits = this.edits();
    return latest.sections.flatMap((section) => {
      const body = edits[section.id];
      return body !== undefined && body !== section.body ? [{ id: section.id, body }] : [];
    });
  }

  private loadReport(caseId: string | null): void {
    this.edits.set({});
    this.actionError.set(null);
    if (!caseId) {
      this.reportState.set({ status: 'IDLE', report: null });
      return;
    }
    this.reportState.set({ status: 'LOADING', report: null });
    this.api.get<CaseReport>(`/v1/cases/${caseId}/report`).subscribe({
      next: (report) => this.reportState.set({ status: 'READY', report }),
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 404) this.reportState.set({ status: 'NONE', report: null });
        else {
          this.reportState.set({ status: 'ERROR', report: null });
          this.actionError.set(failureMessage(error));
        }
      },
    });
  }

  private setReport(report: CaseReport): void {
    this.reportState.set({ status: 'READY', report });
    this.edits.set({});
  }

  private replaceLatest(version: CaseReportVersion): void {
    const report = this.report();
    if (!report) return;
    this.setReport({
      ...report,
      latest: version,
      versions: report.versions.map((summary) =>
        summary.version === version.version
          ? {
              version: version.version,
              status: version.status,
              updatedAt: version.updatedAt,
              updatedBy: version.updatedBy,
              ...(version.signedOffAt ? { signedOffAt: version.signedOffAt } : {}),
              ...(version.signedOffBy ? { signedOffBy: version.signedOffBy } : {}),
            }
          : summary,
      ),
    });
  }

  private run<T>(action: CaseAction, request: Observable<T>, onSuccess: (result: T) => void): void {
    if (this.busy()) return;
    this.busy.set(action);
    this.actionError.set(null);
    this.notice.set(null);
    request.pipe(finalize(() => this.busy.set(null))).subscribe({
      next: onSuccess,
      error: (error: unknown) => this.actionError.set(failureMessage(error)),
    });
  }
}
