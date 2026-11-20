import type { AdvisoryOutcome, CaseSummary, CustomerOutreachProposal, InvestigationEvidence, RiskExplanation, SentinelSwarmReport } from '@sentinel/domain';
import type { ActingContext } from '../../audit/application/audit-trail.js';

/** The investigation workspace's reads: the bundle, fast explanation, case summary, and 7-agent swarm. */
export interface AdviseInvestigation {
  evidence(assessmentId: string, context: ActingContext): Promise<InvestigationEvidence>;
  explain(assessmentId: string, context: ActingContext): Promise<AdvisoryOutcome<RiskExplanation>>;
  summarise(assessmentId: string, context: ActingContext): Promise<AdvisoryOutcome<CaseSummary>>;
  /** The customer's email and call script: Gemini's draft when it passes the checks, fixed wording otherwise. */
  customerOutreach(assessmentId: string, context: ActingContext, wording?: 'DRAFT' | 'TEMPLATE'): Promise<CustomerOutreachProposal>;
  /** The Sentinel 7-Agent Swarm Orchestrator running the complete multi-agent investigation. */
  orchestrateSwarm(assessmentId: string, context: ActingContext): Promise<SentinelSwarmReport>;
}
