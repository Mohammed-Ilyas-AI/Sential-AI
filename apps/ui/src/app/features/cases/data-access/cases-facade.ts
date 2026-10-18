import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import type { Alert, Case, CaseReport, CaseReportSectionId, CaseReportVersion } from '@sentinel/domain';
import type { Observable } from 'rxjs';
import { alertsFeature } from '../../../state/alerts/alerts.feature';
import { CasesApi, type CaseReportEdit } from './cases-api';

const REPORT_PLACEHOLDER = '[Analyst to complete before sign-off]';
const REPORT_SECTIONS: readonly CaseReportSectionId[] = ['SUMMARY', 'TIMELINE', 'EVIDENCE', 'INTERVENTIONS', 'NETWORK', 'RECOMMENDATION'];

@Injectable()
export class CasesFacade {
  private readonly api = inject(CasesApi);
  private readonly store = inject(Store);
  private readonly destroyRef = inject(DestroyRef);
  private readonly queue = this.store.selectSignal(alertsFeature.selectQueue);

  readonly openAlerts = computed<readonly Alert[]>(() => this.queue());
  readonly cases = signal<readonly Case[]>([]);
  readonly selectedCaseId = signal<string | null>(null);
  readonly selectedCase = computed(() => this.cases().find((candidate) => candidate.id === this.selectedCaseId()) ?? null);
  readonly report = signal<CaseReport | null>(null);
  readonly analystIdentity = signal('');
  readonly edits = signal<Readonly<Partial<Record<CaseReportSectionId, string>>>>({});
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly hasEdits = computed(() => Object.keys(this.edits()).length > 0);
  readonly canSignOff = computed(() => {
    const report = this.report()?.latest;
    if (!report || report.status !== 'DRAFT' || this.hasEdits()) return false;
    const recommendation = report.sections.find((section) => section.id === 'RECOMMENDATION');
    return (
      recommendation !== undefined &&
      recommendation.body.trim() !== '' &&
      !recommendation.body.includes(REPORT_PLACEHOLDER) &&
      report.sections.every((section) => section.body.trim() !== '')
    );
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cases) => {
          this.cases.set(cases);
          this.loading.set(false);
          if (!this.selectedCaseId() && cases[0]) this.select(cases[0].id);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.error.set(this.errorMessage(error));
        },
      });
  }

  select(caseId: string): void {
    this.selectedCaseId.set(caseId);
    this.report.set(null);
    this.edits.set({});
    this.error.set(null);
    this.api
      .get(caseId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (investigationCase) => {
          this.cases.update((records) => records.map((candidate) => (candidate.id === caseId ? investigationCase : candidate)));
          this.api
            .report(caseId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (report) => this.report.set(report),
              error: (error: unknown) => {
                if (error instanceof HttpErrorResponse && error.status === 404) return;
                this.error.set(this.errorMessage(error));
              },
            });
        },
        error: (error: unknown) => this.error.set(this.errorMessage(error)),
      });
  }

  openFromAlert(alertId: string): void {
    const identity = this.requireIdentity();
    if (!identity) return;
    this.perform(
      this.api.open(alertId, identity),
      (written) => {
        this.notice.set(written.outcome === 'DUPLICATE' ? 'This alert already has a case.' : 'Case opened from the recorded alert.');
        this.replaceCase(written.record);
        this.selectedCaseId.set(written.record.id);
        this.select(written.record.id);
        this.load();
      },
    );
  }

  escalate(): void {
    const investigationCase = this.selectedCase();
    const identity = this.requireIdentity();
    if (!investigationCase || !identity) return;
    this.perform(this.api.escalate(investigationCase.id, identity), (updated) => {
      this.replaceCase(updated);
      this.notice.set('Case escalated.');
    });
  }

  generateReport(): void {
    const investigationCase = this.selectedCase();
    const identity = this.requireIdentity();
    if (!investigationCase || !identity) return;
    this.perform(this.api.generateReport(investigationCase.id, identity), (written) => {
      this.report.set(written.record);
      this.edits.set({});
      this.notice.set(written.outcome === 'DUPLICATE' ? 'The existing report draft was loaded.' : 'Evidence-backed report draft generated.');
    });
  }

  editSection(id: CaseReportSectionId, body: string): void {
    const section = this.report()?.latest.sections.find((candidate) => candidate.id === id);
    if (!section || body.length > 8_000) return;
    this.edits.update((current) => ({ ...current, [id]: body }));
  }

  saveDraft(): void {
    const report = this.report()?.latest;
    const investigationCase = this.selectedCase();
    const identity = this.requireIdentity();
    if (!report || report.status !== 'DRAFT' || !investigationCase || !identity) return;
    const edits: CaseReportEdit[] = REPORT_SECTIONS.flatMap((id) => {
      const body = this.edits()[id];
      return body === undefined ? [] : [{ id, body }];
    });
    if (edits.length === 0) {
      this.notice.set('There are no unsaved edits.');
      return;
    }
    this.perform(this.api.editReport(investigationCase.id, report.version, identity, report.revision, edits), (updated) => {
      this.updateLatest(updated);
      this.edits.set({});
      this.notice.set('Draft changes saved.');
    });
  }

  signOff(): void {
    const report = this.report()?.latest;
    const investigationCase = this.selectedCase();
    const identity = this.requireIdentity();
    if (!report || !investigationCase || !identity || !this.canSignOff()) return;
    this.perform(this.api.signOff(investigationCase.id, report.version, identity, report.revision), (signed) => {
      this.updateLatest(signed);
      this.notice.set(`Version ${signed.version} signed off by ${signed.signedOffBy}.`);
    });
  }

  startRevision(): void {
    const report = this.report()?.latest;
    const investigationCase = this.selectedCase();
    const identity = this.requireIdentity();
    if (!report || report.status !== 'SIGNED_OFF' || !investigationCase || !identity) return;
    this.perform(this.api.startRevision(investigationCase.id, report.version, identity), (draft) => {
      this.updateLatest(draft);
      this.edits.set({});
      this.notice.set(`Draft version ${draft.version} started.`);
    });
  }

  exportReport(): void {
    const report = this.report()?.latest;
    const investigationCase = this.selectedCase();
    if (!report || !investigationCase) return;
    this.perform(this.api.exportReport(investigationCase.id, report.version), (blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `case-report-v${report.version}.txt`;
      link.click();
      URL.revokeObjectURL(url);
      this.notice.set('Saved report exported.');
    });
  }

  reportBody(sectionId: CaseReportSectionId, original: string): string {
    return this.edits()[sectionId] ?? original;
  }

  private requireIdentity(): string | null {
    const identity = this.analystIdentity().trim();
    if (!identity) {
      this.error.set('Enter your analyst identity before performing this action.');
      return null;
    }
    this.error.set(null);
    return identity;
  }

  private perform<T>(request: Observable<T>, success: (value: T) => void): void {
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (value) => {
        this.busy.set(false);
        success(value);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(this.errorMessage(error));
      },
    });
  }

  private replaceCase(updated: Case): void {
    this.cases.update((records) => records.map((candidate) => (candidate.id === updated.id ? updated : candidate)));
  }

  private updateLatest(latest: CaseReportVersion): void {
    this.report.update((current) => {
      if (!current) return current;
      const versions = current.versions.filter((version) => version.version !== latest.version);
      return {
        caseId: current.caseId,
        latest,
        versions: [...versions, latest].sort((left, right) => left.version - right.version),
      };
    });
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) return 'Access denied for the active institution lens.';
      if (error.status === 404) return 'The requested case or report no longer exists.';
      if (error.status === 409) return 'The record changed or its current state does not allow this action. Reload and try again.';
      if (error.status === 0) return 'The case service is unreachable. Try again when the connection is restored.';
    }
    return 'The case request failed. No success was recorded; retry after checking the current case state.';
  }
}
