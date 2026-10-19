import type { CustomerContactChannel, CustomerContactOutcome } from '@sentinel/domain';
import type { RequestBodyValidator } from '../../../api/middleware/request-validation.middleware.js';
import { FieldReader, toValidationResult } from '../../../api/validation/field-reader.js';

const CHANNELS: readonly CustomerContactChannel[] = ['PHONE', 'SECURE_MESSAGE', 'IN_APP_PUSH', 'AUTOMATED_CALL', 'EMAIL'];
const OUTCOMES: readonly CustomerContactOutcome[] = ['REACHED', 'NO_ANSWER', 'MESSAGE_LEFT', 'NOTIFICATION_SENT'];

export interface KillSwitchActivationBody {
  readonly analystIdentity: string;
  readonly reason: string;
  readonly idempotencyKey: string;
  /** The second step of the two-step confirmation: the client must echo the account it is switching off. */
  readonly confirmAccountId: string;
}

export const killSwitchActivationValidator: RequestBodyValidator<KillSwitchActivationBody> = (body) => {
  const { reader, problems } = FieldReader.forBody(body);
  return toValidationResult(problems, {
    analystIdentity: reader.string('analystIdentity'),
    reason: reader.string('reason'),
    idempotencyKey: reader.string('idempotencyKey'),
    confirmAccountId: reader.token('confirmAccountId'),
  });
};

export interface CustomerVerificationBody {
  readonly idempotencyKey: string;
}

export const customerVerificationValidator: RequestBodyValidator<CustomerVerificationBody> = (body) => {
  const { reader, problems } = FieldReader.forBody(body);
  return toValidationResult(problems, { idempotencyKey: reader.string('idempotencyKey') });
};

export interface CustomerContactBody {
  readonly analystIdentity: string;
  readonly channel: CustomerContactChannel;
  readonly outcome: CustomerContactOutcome;
  readonly note?: string;
  readonly transactionId?: string;
  readonly caseId?: string;
  readonly idempotencyKey: string;
}

export const customerContactValidator: RequestBodyValidator<CustomerContactBody> = (body) => {
  const { reader, problems } = FieldReader.forBody(body);
  const note = reader.optionalString('note');
  const transactionId = reader.optionalString('transactionId');
  const caseId = reader.optionalString('caseId');
  return toValidationResult(problems, {
    analystIdentity: reader.string('analystIdentity'),
    channel: reader.oneOf('channel', CHANNELS),
    outcome: reader.oneOf('outcome', OUTCOMES),
    idempotencyKey: reader.string('idempotencyKey'),
    ...(note !== undefined ? { note } : {}),
    ...(transactionId !== undefined ? { transactionId } : {}),
    ...(caseId !== undefined ? { caseId } : {}),
  });
};
