import type { CaseSummary, RiskExplanation } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { ExplainAndSummarise } from './explain-and-summarise.use-case.js';
import type { ExplanationCache } from './ports/explanation-cache.port.js';
import type { ModelGateway } from './ports/model-gateway.port.js';
import type { ResponseSchemaValidator } from './response-schema.validator.js';
import type { SourceFieldValidator } from './source-field.validator.js';

export interface IntelligenceServiceDependencies {
  readonly modelGateway: ModelGateway;
  readonly explanations: ExplanationCache;
  readonly responseSchemas: ResponseSchemaValidator;
  readonly sourceFields: SourceFieldValidator;
}

export class IntelligenceService implements ExplainAndSummarise {
  constructor(private readonly dependencies: IntelligenceServiceDependencies) {}

  explainRisk(): Promise<RiskExplanation | null> {
    throw new NotYetImplementedError('Gemini risk explanation', 'scheduled for build order step 9');
  }

  summariseCase(): Promise<CaseSummary | null> {
    throw new NotYetImplementedError('Gemini case summary', 'scheduled for build order step 10');
  }
}
