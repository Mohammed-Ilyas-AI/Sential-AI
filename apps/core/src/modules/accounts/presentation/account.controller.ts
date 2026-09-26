import type { BankAccountReport } from '@sentinel/domain';
import type { RequestHandler } from 'express';
import { validatedBodyOf } from '../../../api/middleware/request-validation.middleware.js';
import type { RecordBankAccountReport } from '../application/record-bank-account-report.use-case.js';

export class AccountController {
  constructor(private readonly reports: RecordBankAccountReport) {}

  readonly report: RequestHandler<{ accountToken: string }> = async (request, response) => {
    const report = validatedBodyOf<BankAccountReport>(response);
    if (report.accountToken !== request.params.accountToken) {
      response.status(400).json({ error: 'invalid_request', problems: ['accountToken must match the path'] });
      return;
    }
    const account = await this.reports.applyReport(report);
    response.status(200).json({ accountToken: account.id, protected: account.protected });
  };
}
