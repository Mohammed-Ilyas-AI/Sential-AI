import type { Case, CaseStatus, CaseSummary, InstitutionId, IsoTimestamp } from '@sentinel/domain';
import type { IdempotentWriteResult } from '../../../../platform/idempotency/idempotent-write.js';

/** `cases`: one case per alert, with the evidence bundle exactly as it was compiled when the case opened. */
export interface CaseRepository {
  /** One case per alert: opening the same alert again returns the stored case as a DUPLICATE. */
  open(investigationCase: Case): Promise<IdempotentWriteResult<Case>>;
  findById(caseId: string): Promise<Case | null>;
  /** Newest first, at most `limit`; only the institution's cases when one is given. */
  list(limit: number, institutionId?: InstitutionId): Promise<readonly Case[]>;
  /** Moves the status only from `from`; returns null when the case was not in that status. */
  changeStatus(caseId: string, from: CaseStatus, to: CaseStatus, change: { readonly at: IsoTimestamp; readonly by: string }): Promise<Case | null>;
  attachSummary(caseId: string, summary: CaseSummary): Promise<void>;
}
