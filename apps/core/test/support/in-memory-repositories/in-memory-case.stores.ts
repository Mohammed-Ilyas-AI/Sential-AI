import type { Case, CaseReportVersion, CaseStatus, CaseSummary, InstitutionId } from '@sentinel/domain';
import type { ArchivedCaseSummary, CaseSummaryArchive } from '../../../src/modules/investigations/application/ports/case-summary-archive.port.js';
import type { CaseReportRepository } from '../../../src/modules/cases/application/ports/case-report-repository.port.js';
import type { CaseRepository } from '../../../src/modules/cases/application/ports/case-repository.port.js';
import { ApplicationError } from '../../../src/platform/errors/application-error.js';
import type { IdempotentWriteResult } from '../../../src/platform/idempotency/idempotent-write.js';

export class InMemoryCaseRepository implements CaseRepository {
  private readonly records = new Map<string, Case>();

  async open(investigationCase: Case): Promise<IdempotentWriteResult<Case>> {
    const original = [...this.records.values()].find((record) => record.alertIds.some((id) => investigationCase.alertIds.includes(id)));
    if (original) return { outcome: 'DUPLICATE', record: original };
    this.records.set(investigationCase.id, investigationCase);
    return { outcome: 'CREATED', record: investigationCase };
  }

  async findById(caseId: string): Promise<Case | null> {
    return this.records.get(caseId) ?? null;
  }

  async list(limit: number, institutionId?: InstitutionId): Promise<readonly Case[]> {
    return [...this.records.values()]
      .filter((record) => !institutionId || record.institutionId === institutionId)
      .sort((left, right) => right.openedAt.localeCompare(left.openedAt) || left.id.localeCompare(right.id))
      .slice(0, limit);
  }

  async changeStatus(
    caseId: string,
    from: CaseStatus,
    to: CaseStatus,
    change: { readonly at: string; readonly by: string },
  ): Promise<Case | null> {
    const current = this.records.get(caseId);
    if (!current || current.status !== from) return null;
    const updated: Case = {
      ...current,
      status: to,
      updatedAt: change.at,
      ...(to === 'ESCALATED' ? { escalatedBy: change.by } : {}),
    };
    this.records.set(caseId, updated);
    return updated;
  }

  async attachSummary(caseId: string, summary: CaseSummary): Promise<void> {
    const current = this.records.get(caseId);
    if (!current) throw new ApplicationError('NOT_FOUND', `No case ${caseId}`);
    if (!current.aiSummary) this.records.set(caseId, { ...current, aiSummary: summary });
  }
}

export class InMemoryCaseReportRepository implements CaseReportRepository {
  private readonly records = new Map<string, CaseReportVersion[]>();

  async insertVersion(version: CaseReportVersion): Promise<void> {
    const versions = this.records.get(version.caseId) ?? [];
    if (versions.some((candidate) => candidate.version === version.version)) {
      throw new ApplicationError('CONFLICT', `Case ${version.caseId} report version ${version.version} already exists`);
    }
    this.records.set(version.caseId, [...versions, version].sort((left, right) => left.version - right.version));
  }

  async versions(caseId: string): Promise<readonly CaseReportVersion[]> {
    return [...(this.records.get(caseId) ?? [])];
  }

  async replaceDraft(next: CaseReportVersion, expectedRevision: number): Promise<boolean> {
    const versions = this.records.get(next.caseId) ?? [];
    const index = versions.findIndex(
      (candidate) => candidate.version === next.version && candidate.status === 'DRAFT' && candidate.revision === expectedRevision,
    );
    if (index === -1) return false;
    const updated = [...versions];
    updated[index] = next;
    this.records.set(next.caseId, updated);
    return true;
  }
}

export class InMemoryCaseSummaryArchive implements CaseSummaryArchive {
  private readonly records = new Map<string, ArchivedCaseSummary>();

  async find(assessmentId: string): Promise<ArchivedCaseSummary | null> {
    return this.records.get(assessmentId) ?? null;
  }

  async store(archived: ArchivedCaseSummary): Promise<void> {
    if (!this.records.has(archived.assessmentId)) this.records.set(archived.assessmentId, archived);
  }
}
