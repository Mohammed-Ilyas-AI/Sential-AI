import type { DecisionRequest } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { RequestBodyValidator } from '../../../api/middleware/request-validation.middleware.js';

/** Accepts only a schemaVersion 1.0, PENDING TransactionEvent with integer minor-unit amounts in SGD. */
export const decisionRequestValidator: RequestBodyValidator<DecisionRequest> = () => {
  throw new NotYetImplementedError('Decision request validation', 'scheduled for build order step 3');
};
