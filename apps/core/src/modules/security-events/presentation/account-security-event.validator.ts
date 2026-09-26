import type { AccountSecurityEvent } from '@sentinel/domain';
import type { RequestBodyValidator } from '../../../api/middleware/request-validation.middleware.js';
import { FieldReader, toValidationResult } from '../../../api/validation/field-reader.js';

const EVENT_TYPES = [
  'NEW_DEVICE',
  'TOKEN_ACTIVATED',
  'PAYEE_ADDED',
  'PASSWORD_CHANGED',
  'MOBILE_NUMBER_CHANGED',
  'PROFILE_CHANGED',
] as const;

export const accountSecurityEventValidator: RequestBodyValidator<AccountSecurityEvent> = (body) => {
  const { reader, problems } = FieldReader.forBody(body);
  const deviceToken = reader.optionalToken('deviceToken');
  const beneficiaryToken = reader.optionalToken('beneficiaryToken');
  const eventType = reader.oneOf('eventType', EVENT_TYPES);
  if ((eventType === 'NEW_DEVICE' || eventType === 'TOKEN_ACTIVATED') && !deviceToken) {
    reader.addProblem(`deviceToken is required for ${eventType}`);
  }
  if (eventType === 'PAYEE_ADDED' && !beneficiaryToken) reader.addProblem('beneficiaryToken is required for PAYEE_ADDED');
  const event: AccountSecurityEvent = {
    schemaVersion: reader.literal('schemaVersion', '1.0'),
    tenantId: reader.string('tenantId'),
    eventId: reader.string('eventId'),
    idempotencyKey: reader.string('idempotencyKey'),
    accountToken: reader.token('accountToken'),
    eventType,
    ...(deviceToken ? { deviceToken } : {}),
    ...(beneficiaryToken ? { beneficiaryToken } : {}),
    occurredAt: reader.timestamp('occurredAt'),
  };
  return toValidationResult(problems, event);
};
