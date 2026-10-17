import {
  MODEL_RESPONSE_MAX_RETRIES,
  type AdvisoryFallbackReason,
  type AdvisoryOutcome,
  type CaseSummary,
  type EvidenceBundle,
  type ModelJob,
  type RiskExplanation,
} from '@sentinel/domain';
import type { Clock } from '../../../platform/time/clock.js';
import type { ExplainAndSummarise } from './explain-and-summarise.use-case.js';
import type { ExplanationCache } from './ports/explanation-cache.port.js';
import { ModelUnavailableError, type ModelGateway } from './ports/model-gateway.port.js';
import type { ResponseSchemaValidator } from './response-schema.validator.js';
import type { SourceFieldValidator } from './source-field.validator.js';

export interface IntelligenceServiceDependencies {
  readonly modelGateway: ModelGateway;
  readonly explanations: ExplanationCache;
  readonly responseSchemas: ResponseSchemaValidator;
  readonly sourceFields: SourceFieldValidator;
  readonly clock: Clock;
}

interface Accepted<TAdvisory> {
  readonly advisory: TAdvisory;
  readonly droppedClaims: number;
}

/**
 * Validates every model response against its schema and grounds every claim in the bundle that was sent.
 * Unparseable, schema-invalid or ungrounded output is retried once, then the outcome is FALLBACK and the UI
 * renders the deterministic attribution alone. Nothing here can change a score, a decision or a hold.
 */
export class IntelligenceService implements ExplainAndSummarise {
  constructor(private readonly dependencies: IntelligenceServiceDependencies) {}

  async explainRisk(evidence: EvidenceBundle, assessmentId: string): Promise<AdvisoryOutcome<RiskExplanation>> {
    const { explanations, responseSchemas, clock } = this.dependencies;
    const cached = await explanations.find(assessmentId);
    if (cached) return { status: 'CACHED', advisory: cached, attempts: 0, droppedClaims: 0 };

    const outcome = await this.generate('RISK_EXPLANATION', evidence, (raw) => {
      const explanation = responseSchemas.riskExplanation(raw, assessmentId, clock.now().toISOString());
      return explanation ? { advisory: explanation, droppedClaims: 0 } : null;
    });
    if (outcome.status === 'GENERATED') await explanations.store(outcome.advisory);
    return outcome;
  }

  summariseCase(evidence: EvidenceBundle): Promise<AdvisoryOutcome<CaseSummary>> {
    const { responseSchemas, sourceFields } = this.dependencies;
    return this.generate('CASE_SUMMARY', evidence, (raw) => {
      const summary = responseSchemas.caseSummary(raw);
      if (!summary) return null;
      const grounded = sourceFields.groundedIn(summary, evidence);
      // A summary left with no grounded claim is not evidence-based; treat it as invalid output.
      return summary.evidence.length > 0 && grounded.summary.evidence.length === 0
        ? null
        : { advisory: grounded.summary, droppedClaims: grounded.droppedClaims };
    });
  }

  private async generate<TAdvisory>(
    job: ModelJob,
    evidence: EvidenceBundle,
    accept: (raw: unknown) => Accepted<TAdvisory> | null,
  ): Promise<AdvisoryOutcome<TAdvisory>> {
    let attempts = 0;
    let reason: AdvisoryFallbackReason = 'INVALID_RESPONSE';
    while (attempts <= MODEL_RESPONSE_MAX_RETRIES) {
      attempts += 1;
      try {
        const accepted = accept(await this.dependencies.modelGateway.generate(job, evidence));
        if (accepted) return { status: 'GENERATED', advisory: accepted.advisory, attempts, droppedClaims: accepted.droppedClaims };
        reason = 'INVALID_RESPONSE';
      } catch (error) {
        if (!(error instanceof ModelUnavailableError)) throw error;
        if (error.reason === 'NOT_CONFIGURED') return { status: 'FALLBACK', advisory: null, reason: 'MODEL_NOT_CONFIGURED', attempts };
        if (error.reason === 'CREDENTIALS') return { status: 'FALLBACK', advisory: null, reason: 'MODEL_CREDENTIALS_UNAVAILABLE', attempts };
        reason = 'MODEL_UNAVAILABLE';
      }
    }
    return { status: 'FALLBACK', advisory: null, reason, attempts };
  }
}
