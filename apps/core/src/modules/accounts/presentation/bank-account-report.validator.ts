import type { BankAccountReport } from '@sentinel/domain';
import type { RequestBodyValidator } from '../../../api/middleware/request-validation.middleware.js';
import { FieldReader, toValidationResult } from '../../../api/validation/field-reader.js';

export const bankAccountReportValidator: RequestBodyValidator<BankAccountReport> = (body) => {
  const { reader, problems } = FieldReader.forBody(body);
  const behaviour = reader.object('behaviour');
  const report: BankAccountReport = {
    schemaVersion: reader.literal('schemaVersion', '1.0'),
    tenantId: reader.string('tenantId'),
    accountToken: reader.token('accountToken'),
    institutionId: reader.string('institutionId'),
    displayReference: reader.string('displayReference'),
    openedAt: reader.timestamp('openedAt'),
    balance: reader.minorUnits('balance'),
    balanceAsOf: reader.timestamp('balanceAsOf'),
    knownDeviceTokens: reader.tokenArray('knownDeviceTokens'),
    knownPayeeTokens: reader.tokenArray('knownPayeeTokens'),
    behaviour: {
      velocityRatio: behaviour.number('velocityRatio', 0),
      amountP95: behaviour.minorUnits('amountP95'),
      observedAt: behaviour.timestamp('observedAt'),
    },
  };
  return toValidationResult(problems, report);
};
