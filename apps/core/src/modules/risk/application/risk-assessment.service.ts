import type { RecordedRiskAssessment } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { AssessRisk, RiskRule } from '@sentinel/rules';
import type { IdGenerator } from '../../../platform/ids/id-generator.js';
import type { AssessTransactionRisk } from './assess-transaction-risk.use-case.js';
import type { AssessmentRepository } from './ports/assessment-repository.port.js';

/** The rule engine is injected, so a new rule never changes this service. */
export interface RiskEngine {
  readonly assess: AssessRisk;
  readonly rules: readonly RiskRule[];
  readonly rulesetVersion: string;
}

/** Runs @sentinel/rules and records the assessment once. Holds no scoring logic of its own. */
export class RiskAssessmentService implements AssessTransactionRisk {
  constructor(
    private readonly engine: RiskEngine,
    private readonly assessments: AssessmentRepository,
    private readonly ids: IdGenerator,
  ) {}

  assessAndRecord(): Promise<RecordedRiskAssessment> {
    throw new NotYetImplementedError('Risk assessment', 'scheduled for build order step 6');
  }
}
