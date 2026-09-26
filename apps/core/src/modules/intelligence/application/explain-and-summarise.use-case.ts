import type { CaseSummary, EvidenceBundle, RiskExplanation } from '@sentinel/domain';

/**
 * Explains decisions that are already made. Asynchronous and best-effort: if Gemini is slow or down, the
 * analyst loses the narrative, never the protection.
 */
export interface ExplainAndSummarise {
  explainRisk(evidence: EvidenceBundle, assessmentId: string): Promise<RiskExplanation | null>;
  summariseCase(evidence: EvidenceBundle): Promise<CaseSummary | null>;
}
