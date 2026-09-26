import type { RecordedRiskAssessment, RiskExplanation } from '@sentinel/domain';
import type { CollectionDefinition, MongoDocument } from './collection-definition.js';

/**
 * Insert-only RiskAssessments. contributions[] is written once and never updated; the cached fast-tier
 * explanation is a separate field and never touches it.
 */
export type AssessmentDocument = MongoDocument<RecordedRiskAssessment & { readonly explanation?: RiskExplanation }>;

export const assessmentsCollection: CollectionDefinition = {
  name: 'assessments',
  indexes: [
    { key: { transactionId: 1 }, name: 'transactionId' },
    { key: { accountId: 1, evaluatedAt: -1 }, name: 'accountId_evaluatedAt' },
  ],
};
