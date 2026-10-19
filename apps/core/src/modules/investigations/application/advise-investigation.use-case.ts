import type { AdvisoryOutcome, CaseSummary, CustomerOutreachProposal, InvestigationEvidence, RiskExplanation } from '@sentinel/domain';
import type { ActingContext } from '../../audit/application/audit-trail.js';

/** The investigation workspace's three reads: the bundle as sent, the fast-tier explanation, the case summary. */
export interface AdviseInvestigation {
  evidence(assessmentId: string, context: ActingContext): Promise<InvestigationEvidence>;
  explain(assessmentId: string, context: ActingContext): Promise<AdvisoryOutcome<RiskExplanation>>;
  summarise(assessmentId: string, context: ActingContext): Promise<AdvisoryOutcome<CaseSummary>>;
  /** The customer's email and call script: Gemini's draft when it passes the checks, fixed wording otherwise. */
  customerOutreach(assessmentId: string, context: ActingContext, wording?: 'DRAFT' | 'TEMPLATE'): Promise<CustomerOutreachProposal>;
}
