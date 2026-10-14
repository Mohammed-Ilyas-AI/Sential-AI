import type { AdvisoryOutcome, AgentInvestigation, EvidenceBundle } from '@sentinel/domain';

/**
 * The agentic investigation: Gemini plans its own evidence gathering over read-only tools, then files a grounded
 * case summary. Best-effort and advisory, exactly like ExplainAndSummarise; it can never change a decision.
 */
export interface InvestigateWithAgent {
  investigate(evidence: EvidenceBundle, assessmentId: string): Promise<AdvisoryOutcome<AgentInvestigation>>;
}
