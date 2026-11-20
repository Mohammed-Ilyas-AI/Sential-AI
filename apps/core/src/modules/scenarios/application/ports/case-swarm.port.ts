import type { InvestigationEvidence, SentinelSwarmReport } from '@sentinel/domain';
import type { ActingContext } from '../../../audit/application/audit-trail.js';

/**
 * What the multi-scam burst asks of the investigation workspace for each case: the evidence bundle the gate's
 * decision produced, and the 7-agent swarm's findings on it. Read-only; neither can change a decision.
 */
export interface CaseSwarm {
  evidence(assessmentId: string, context: ActingContext): Promise<InvestigationEvidence>;
  orchestrateSwarm(assessmentId: string, context: ActingContext): Promise<SentinelSwarmReport>;
}
