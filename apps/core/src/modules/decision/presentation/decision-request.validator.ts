import type { DecisionRequest } from '@sentinel/domain';
import type { RequestBodyValidator } from '../../../api/middleware/request-validation.middleware.js';
import { FieldReader, toValidationResult } from '../../../api/validation/field-reader.js';
import { readTransactionEvent } from '../../transactions/presentation/transaction-event.validator.js';

/** A schemaVersion 1.0, PENDING TransactionEvent with integer minor-unit amounts in SGD. */
export const decisionRequestValidator: RequestBodyValidator<DecisionRequest> = (body) => {
  const { reader, problems } = FieldReader.forBody(body);
  const event = readTransactionEvent(reader);
  if (event.status !== 'PENDING') reader.addProblem('status must be "PENDING": decisions are requested before the transfer commits');
  return toValidationResult(problems, { ...event, status: 'PENDING' });
};
