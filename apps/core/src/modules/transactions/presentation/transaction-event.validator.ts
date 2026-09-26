import type { TransactionEvent } from '@sentinel/domain';
import type { RequestBodyValidator } from '../../../api/middleware/request-validation.middleware.js';
import { FieldReader, toValidationResult } from '../../../api/validation/field-reader.js';

const STATUSES = ['PENDING', 'AUTHORISED', 'SETTLED', 'REVERSED', 'CANCELLED'] as const;
const CHANNELS = ['APP', 'IBANKING'] as const;
const TYPES = ['TRANSFER', 'GIRO', 'STANDING', 'BILL'] as const;

/** Reads a canonical TransactionEvent: schemaVersion 1.0, tokens only, integer SGD minor units, UTC timestamps. */
export function readTransactionEvent(reader: FieldReader): TransactionEvent {
  const networkReference = reader.optionalString('networkReference');
  const deviceToken = reader.optionalToken('deviceToken');
  const beneficiaryToken = reader.optionalToken('beneficiaryToken');
  return {
    schemaVersion: reader.literal('schemaVersion', '1.0'),
    tenantId: reader.string('tenantId'),
    eventId: reader.string('eventId'),
    idempotencyKey: reader.string('idempotencyKey'),
    accountSequence: reader.integer('accountSequence', 0),
    transactionId: reader.string('transactionId'),
    status: reader.oneOf('status', STATUSES),
    sourceAccountToken: reader.token('sourceAccountToken'),
    destinationInstitutionId: reader.string('destinationInstitutionId'),
    destinationAccountToken: reader.token('destinationAccountToken'),
    ...(networkReference ? { networkReference } : {}),
    ...(deviceToken ? { deviceToken } : {}),
    ...(beneficiaryToken ? { beneficiaryToken } : {}),
    amount: reader.minorUnits('amount', { positive: true }),
    currency: reader.literal('currency', 'SGD'),
    channel: reader.oneOf('channel', CHANNELS),
    type: reader.oneOf('type', TYPES),
    occurredAt: reader.timestamp('occurredAt'),
  };
}

export const transactionEventValidator: RequestBodyValidator<TransactionEvent> = (body) => {
  const { reader, problems } = FieldReader.forBody(body);
  const event = readTransactionEvent(reader);
  return toValidationResult(problems, event);
};
