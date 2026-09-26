import type { AccountSecurityEvent } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { RequestBodyValidator } from '../../../api/middleware/request-validation.middleware.js';

export const accountSecurityEventValidator: RequestBodyValidator<AccountSecurityEvent> = () => {
  throw new NotYetImplementedError('Account security event validation', 'scheduled for build order step 6');
};
