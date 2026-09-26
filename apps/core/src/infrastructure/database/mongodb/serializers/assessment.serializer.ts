import type { RecordedRiskAssessment } from '@sentinel/domain';
import type { AssessmentDocument } from '../collections/assessments.collection.js';

export function toAssessmentDocument(assessment: RecordedRiskAssessment): AssessmentDocument {
  return { ...assessment, _id: assessment.assessmentId };
}

export function fromAssessmentDocument({ _id, explanation, ...assessment }: AssessmentDocument): RecordedRiskAssessment {
  return assessment;
}
