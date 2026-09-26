import type { CaseSummary, EvidenceBundle } from '@sentinel/domain';

/**
 * When Gemini is unavailable the workspace still renders the deterministic attribution: the analyst loses the
 * narrative, never the protection.
 */
export interface InvestigationView {
  readonly evidence: EvidenceBundle;
  readonly summary: CaseSummary | null;
  readonly geminiAvailable: boolean;
}
