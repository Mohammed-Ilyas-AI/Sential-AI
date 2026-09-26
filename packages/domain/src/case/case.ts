import type { CaseSummary } from '../intelligence/case-summary.js';
import type { EvidenceBundle } from '../intelligence/evidence-bundle.js';

export type CaseStatus = 'OPEN' | 'ESCALATED' | 'CLOSED_FRAUD' | 'CLOSED_LEGITIMATE';

export interface Case {
  readonly id: string;
  readonly accountId: string;
  readonly alertIds: readonly string[];
  readonly evidence: EvidenceBundle;
  /** Gemini output, schema-validated and grounded in the bundle. */
  readonly aiSummary?: CaseSummary;
  readonly status: CaseStatus;
}
