import type { Case, CaseStatus, CaseSummary } from '@sentinel/domain';

export interface CaseRepository {
  open(investigationCase: Case): Promise<void>;
  findById(caseId: string): Promise<Case | null>;
  changeStatus(caseId: string, status: CaseStatus): Promise<void>;
  attachSummary(caseId: string, summary: CaseSummary): Promise<void>;
}
