import {
  MODEL_RESPONSE_MAX_RETRIES,
  type AdvisoryFallbackReason,
  type AdvisoryOutcome,
  type CaseSummary,
  type CustomerOutreachDraft,
  type EvidenceBundle,
  type ModelJob,
  type RiskExplanation,
} from '@sentinel/domain';
import type { Clock } from '../../../platform/time/clock.js';
import type { ExplainAndSummarise } from './explain-and-summarise.use-case.js';
import type { ExplanationCache } from './ports/explanation-cache.port.js';
import { ModelUnavailableError, type ModelGateway, type ModelUnavailableReason } from './ports/model-gateway.port.js';
import type { ResponseSchemaValidator } from './response-schema.validator.js';
import type { SourceFieldValidator } from './source-field.validator.js';

export interface IntelligenceServiceDependencies {
  readonly modelGateway: ModelGateway;
  readonly explanations: ExplanationCache;
  readonly responseSchemas: ResponseSchemaValidator;
  readonly sourceFields: SourceFieldValidator;
  readonly clock: Clock;
}

/** Failures that end the request at once: an identical second call cannot succeed or would only bill twice. */
const FINAL_FAILURES: Readonly<Partial<Record<ModelUnavailableReason, AdvisoryFallbackReason>>> = {
  NOT_CONFIGURED: 'MODEL_NOT_CONFIGURED',
  CREDENTIALS: 'MODEL_CREDENTIALS_UNAVAILABLE',
  TIMED_OUT: 'MODEL_TIMED_OUT',
  REJECTED: 'MODEL_UNAVAILABLE',
};

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
  /** One model call per assessment at a time: a second Explain while the first is running shares its result. */
  private readonly explaining = new Map<string, Promise<AdvisoryOutcome<RiskExplanation>>>();

  constructor(private readonly dependencies: IntelligenceServiceDependencies) {}

  explainRisk(evidence: EvidenceBundle, assessmentId: string): Promise<AdvisoryOutcome<RiskExplanation>> {
    const running = this.explaining.get(assessmentId);
    if (running) return running;
    const explanation = this.explainOnce(evidence, assessmentId).finally(() => this.explaining.delete(assessmentId));
    this.explaining.set(assessmentId, explanation);
    return explanation;
  }

  private async explainOnce(evidence: EvidenceBundle, assessmentId: string): Promise<AdvisoryOutcome<RiskExplanation>> {
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

  /**
   * The customer needs only the paused transfer, so the model gets that one transaction and nothing that says why
   * it was paused: no contributions, device, payee, alert or network history. In a takeover the attacker may read
   * the customer's messages, and the signals that caught them must not reach them. Less to read, a faster draft.
   */
  draftCustomerOutreach(evidence: EvidenceBundle): Promise<AdvisoryOutcome<CustomerOutreachDraft>> {
    const customerFacing: EvidenceBundle = {
      ...evidence,
      assessment: { ...evidence.assessment, contributions: [] },
      recentTransactions: evidence.recentTransactions.filter((transaction) => transaction.id === evidence.assessment.transactionId),
      deviceHistory: [],
      payeeHistory: [],
      priorAlerts: [],
      interventions: [],
      neighbourhood: { ...evidence.neighbourhood, nodes: [], edges: [], truncated: false },
    };
    return this.generate('CUSTOMER_OUTREACH', customerFacing, (raw) => {
      const draft = this.dependencies.responseSchemas.customerOutreach(raw);
      return draft ? { advisory: draft, droppedClaims: 0 } : null;
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
        const final = FINAL_FAILURES[error.reason];
        if (final) return { status: 'FALLBACK', advisory: null, reason: final, attempts };
        reason = 'MODEL_UNAVAILABLE';
      }
    }
    return { status: 'FALLBACK', advisory: null, reason, attempts };
  }
}
