import type { AdvisoryOutcome, CaseSummary, EvidenceBundle, RiskExplanation } from '@sentinel/domain';

/**
 * Explains decisions that are already made. Asynchronous and best-effort: if Gemini is slow, down or wrong, the
 * analyst loses the narrative, never the protection, and the outcome says which.
 */
export interface ExplainAndSummarise {
  explainRisk(evidence: EvidenceBundle, assessmentId: string): Promise<AdvisoryOutcome<RiskExplanation>>;
  summariseCase(evidence: EvidenceBundle): Promise<AdvisoryOutcome<CaseSummary>>;
}
