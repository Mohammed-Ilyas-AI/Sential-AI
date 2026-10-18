import type { CaseSummaryConfidence } from '../intelligence/case-summary.js';
import type { IsoTimestamp } from '../time/iso-timestamp.js';

export type CaseReportStatus = 'DRAFT' | 'SIGNED_OFF';

export type CaseReportSectionId = 'SUMMARY' | 'TIMELINE' | 'EVIDENCE' | 'INTERVENTIONS' | 'NETWORK' | 'RECOMMENDATION';

/** Where a statement in the report comes from: a field of the persisted evidence bundle and its value. */
export interface CaseReportSource {
  readonly field: string;
  readonly value: string;
}

export interface CaseReportSection {
  readonly id: CaseReportSectionId;
  readonly title: string;
  /** Plain text the analyst may edit while the version is a draft. */
  readonly body: string;
  readonly sources: readonly CaseReportSource[];
  /** True once an analyst has changed the generated text. */
  readonly edited: boolean;
}

/** The AI case summary is included only when a grounded one was already generated; the report never depends on it. */
export type CaseReportAiSummary =
  | {
      readonly status: 'INCLUDED';
      readonly hypothesis: string;
      readonly confidence: CaseSummaryConfidence;
      readonly archivedAt: IsoTimestamp;
    }
  | { readonly status: 'NOT_AVAILABLE' };

/**
 * One version of a case report (M§5.6). A draft may be edited; a signed-off version is immutable. Editing after
 * sign-off starts a new draft version that supersedes it, so the signed record never changes.
 */
export interface CaseReportVersion {
  readonly reportId: string;
  readonly caseId: string;
  readonly version: number;
  /** Increments on every saved edit of a draft; guards against overwriting a concurrent edit. */
  readonly revision: number;
  readonly status: CaseReportStatus;
  readonly sections: readonly CaseReportSection[];
  readonly basedOn: {
    readonly accountId: string;
    readonly assessmentId: string;
    readonly alertIds: readonly string[];
    readonly policyVersion: string;
    readonly rulesetVersion: string;
    readonly evidenceCompiledAt: IsoTimestamp;
  };
  readonly aiSummary: CaseReportAiSummary;
  readonly createdAt: IsoTimestamp;
  readonly createdBy: string;
  readonly updatedAt: IsoTimestamp;
  readonly updatedBy: string;
  readonly signedOffAt?: IsoTimestamp;
  readonly signedOffBy?: string;
  /** The signed-off version this draft was started from. */
  readonly supersedesVersion?: number;
}

export interface CaseReport {
  readonly caseId: string;
  readonly latest: CaseReportVersion;
  readonly versions: readonly Pick<CaseReportVersion, 'version' | 'status' | 'updatedAt' | 'updatedBy' | 'signedOffAt' | 'signedOffBy'>[];
}
