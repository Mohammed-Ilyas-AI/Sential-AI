import type { CaseReportVersion } from '@sentinel/domain';

/**
 * `case_reports`: one document per version. A signed-off version is never written again; a draft is replaced
 * only when its stored revision is the one the editor read.
 */
export interface CaseReportRepository {
  /** Fails with a CONFLICT when the version already exists, so two generations race to one report. */
  insertVersion(version: CaseReportVersion): Promise<void>;
  versions(caseId: string): Promise<readonly CaseReportVersion[]>;
  /** Replaces a DRAFT whose revision is `expectedRevision`; returns false when it was signed or changed meanwhile. */
  replaceDraft(next: CaseReportVersion, expectedRevision: number): Promise<boolean>;
}
