import type { CaseSummary, IsoTimestamp } from '@sentinel/domain';

export interface ArchivedCaseSummary {
  readonly assessmentId: string;
  readonly summary: CaseSummary;
  readonly archivedAt: IsoTimestamp;
}

/**
 * The first schema-validated, grounded case summary generated for an assessment, kept once so a case report can
 * cite it later without asking the model again. Written only after a GENERATED outcome; never overwritten.
 */
export interface CaseSummaryArchive {
  find(assessmentId: string): Promise<ArchivedCaseSummary | null>;
  store(archived: ArchivedCaseSummary): Promise<void>;
}
