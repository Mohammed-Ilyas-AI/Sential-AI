import type { AccountSecurityEvent } from '@sentinel/domain';
import type { RequestHandler } from 'express';
import { validatedBodyOf } from '../../../api/middleware/request-validation.middleware.js';
import type { RecordAccountSecurityEvent } from '../application/record-account-security-event.use-case.js';

export class SecurityEventController {
  constructor(private readonly recordSecurityEvent: RecordAccountSecurityEvent) {}

  readonly record: RequestHandler = async (_request, response) => {
    await this.recordSecurityEvent.record(validatedBodyOf<AccountSecurityEvent>(response));
    response.status(202).end();
  };
}
