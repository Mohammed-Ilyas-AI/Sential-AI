import type { AdvisoryOutcome, CaseSummary, InvestigationEvidence, RiskExplanation } from '@sentinel/domain';
import type { ActingContext } from '../../audit/application/audit-trail.js';
import type { TenantAccessService } from '../../tenant-access/application/tenant-access.service.js';
import type { ExplainAndSummarise } from '../../intelligence/application/explain-and-summarise.use-case.js';
import type { AdviseInvestigation } from './advise-investigation.use-case.js';
import type { CompileEvidenceBundle } from './compile-evidence-bundle.use-case.js';
import type { CaseSummaryArchive } from './ports/case-summary-archive.port.js';
import type { Clock } from '../../../platform/time/clock.js';

/** Compiles the bundle first, then asks for advice on exactly that bundle. Read-only towards every decision. */
export class InvestigationAdvisor implements AdviseInvestigation {
  constructor(
    private readonly bundles: CompileEvidenceBundle,
    private readonly intelligence: ExplainAndSummarise,
    private readonly summaries: CaseSummaryArchive,
    private readonly clock: Clock,
    private readonly access: TenantAccessService,
  ) {}

  async evidence(assessmentId: string, context: ActingContext): Promise<InvestigationEvidence> {
    await this.authorise(assessmentId, context);
    return { assessmentId, evidence: await this.bundles.compile(assessmentId) };
  }

  async explain(assessmentId: string, context: ActingContext): Promise<AdvisoryOutcome<RiskExplanation>> {
    await this.authorise(assessmentId, context);
    return this.intelligence.explainRisk(await this.bundles.compile(assessmentId), assessmentId);
  }

  async summarise(assessmentId: string, context: ActingContext): Promise<AdvisoryOutcome<CaseSummary>> {
    await this.authorise(assessmentId, context);
    const outcome = await this.intelligence.summariseCase(await this.bundles.compile(assessmentId));
    if (outcome.status === 'GENERATED' || outcome.status === 'CACHED') {
      await this.summaries.store({ assessmentId, summary: outcome.advisory, archivedAt: this.clock.now().toISOString() });
    }
    return outcome;
  }

  private async authorise(assessmentId: string, context: ActingContext): Promise<void> {
    const accountId = await this.bundles.accountIdForAssessment(assessmentId);
    await this.access.authoriseAccount(context, accountId, 'investigation', { accountId });
  }
}
