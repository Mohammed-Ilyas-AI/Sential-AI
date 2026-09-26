import type { TransactionEvent } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { RequestBodyValidator } from '../../../../api/middleware/request-validation.middleware.js';

export const transactionEventValidator: RequestBodyValidator<TransactionEvent> = () => {
  throw new NotYetImplementedError('TransactionEvent validation', 'scheduled for build order step 3');
};
