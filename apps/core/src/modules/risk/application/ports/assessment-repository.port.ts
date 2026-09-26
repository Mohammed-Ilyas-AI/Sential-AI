import type { RecordedRiskAssessment } from '@sentinel/domain';

/** `assessments` is insert-only: no code path may modify a stored contribution. */
export interface AssessmentRepository {
  insert(assessment: RecordedRiskAssessment): Promise<void>;
  findById(assessmentId: string): Promise<RecordedRiskAssessment | null>;
}
