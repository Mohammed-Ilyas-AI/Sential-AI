import type { CaseSummary } from '../intelligence/case-summary.js';
import type { EvidenceBundle } from '../intelligence/evidence-bundle.js';
import type { InstitutionId } from '../tenant/tenant-identifiers.js';
import type { IsoTimestamp } from '../time/iso-timestamp.js';

export type CaseStatus = 'OPEN' | 'ESCALATED' | 'CLOSED_FRAUD' | 'CLOSED_LEGITIMATE';

/** "Investigate alert" opens one case per alert; the evidence bundle is persisted as it was compiled. */
export interface Case {
  readonly id: string;
  readonly accountId: string;
  readonly accountReference?: string;
  readonly institutionId: InstitutionId;
  readonly assessmentId: string;
  readonly alertIds: readonly string[];
  readonly evidence: EvidenceBundle;
  readonly evidenceCompiledAt: IsoTimestamp;
  readonly openedAt: IsoTimestamp;
  readonly openedBy: string;
  readonly updatedAt: IsoTimestamp;
  readonly escalatedBy?: string;
  /** Gemini output, schema-validated and grounded in the bundle. */
  readonly aiSummary?: CaseSummary;
  readonly status: CaseStatus;
}
