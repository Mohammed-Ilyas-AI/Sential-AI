import type { RiskAssessment } from './risk-assessment.js';

/** A RiskAssessment as stored in `assessments`: insert-only, addressed by the assessmentId a decision cites. */
export interface RecordedRiskAssessment extends RiskAssessment {
  readonly assessmentId: string;
  readonly accountId: string;
  readonly rulesetVersion: string;
}
