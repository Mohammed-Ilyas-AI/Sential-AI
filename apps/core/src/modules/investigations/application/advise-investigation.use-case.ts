import type { AdvisoryOutcome, AgentInvestigation, CaseSummary, InvestigationEvidence, RiskExplanation } from '@sentinel/domain';

/**
 * The investigation workspace's reads: the bundle as sent, the fast-tier explanation, the case summary, and the
 * agentic investigation in which Gemini gathers the evidence itself through read-only tools.
 */
export interface AdviseInvestigation {
  evidence(assessmentId: string): Promise<InvestigationEvidence>;
  explain(assessmentId: string): Promise<AdvisoryOutcome<RiskExplanation>>;
  summarise(assessmentId: string): Promise<AdvisoryOutcome<CaseSummary>>;
  investigate(assessmentId: string): Promise<AdvisoryOutcome<AgentInvestigation>>;
}
