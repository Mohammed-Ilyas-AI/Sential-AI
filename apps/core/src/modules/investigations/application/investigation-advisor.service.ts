import type { AdvisoryOutcome, CaseSummary, InvestigationEvidence, RiskExplanation } from '@sentinel/domain';
import type { ExplainAndSummarise } from '../../intelligence/application/explain-and-summarise.use-case.js';
import type { AdviseInvestigation } from './advise-investigation.use-case.js';
import type { CompileEvidenceBundle } from './compile-evidence-bundle.use-case.js';

/** Compiles the bundle first, then asks for advice on exactly that bundle. Read-only towards every decision. */
export class InvestigationAdvisor implements AdviseInvestigation {
  constructor(
    private readonly bundles: CompileEvidenceBundle,
    private readonly intelligence: ExplainAndSummarise,
  ) {}

  async evidence(assessmentId: string): Promise<InvestigationEvidence> {
    return { assessmentId, evidence: await this.bundles.compile(assessmentId) };
  }

  async explain(assessmentId: string): Promise<AdvisoryOutcome<RiskExplanation>> {
    return this.intelligence.explainRisk(await this.bundles.compile(assessmentId), assessmentId);
  }

  async summarise(assessmentId: string): Promise<AdvisoryOutcome<CaseSummary>> {
    return this.intelligence.summariseCase(await this.bundles.compile(assessmentId));
  }
}
