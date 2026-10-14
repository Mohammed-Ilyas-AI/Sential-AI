import type { AdvisoryOutcome, CaseSummary, InvestigationEvidence, RiskExplanation } from '@sentinel/domain';

/** The investigation workspace's three reads: the bundle as sent, the fast-tier explanation, the case summary. */
export interface AdviseInvestigation {
  evidence(assessmentId: string): Promise<InvestigationEvidence>;
  explain(assessmentId: string): Promise<AdvisoryOutcome<RiskExplanation>>;
  summarise(assessmentId: string): Promise<AdvisoryOutcome<CaseSummary>>;
}
