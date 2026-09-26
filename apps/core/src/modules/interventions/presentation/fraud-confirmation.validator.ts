import type { RequestBodyValidator } from '../../../api/middleware/request-validation.middleware.js';
import { FieldReader, toValidationResult } from '../../../api/validation/field-reader.js';

export interface FraudConfirmation {
  readonly analystIdentity: string;
}

export const fraudConfirmationValidator: RequestBodyValidator<FraudConfirmation> = (body) => {
  const { reader, problems } = FieldReader.forBody(body);
  return toValidationResult(problems, { analystIdentity: reader.string('analystIdentity') });
};
