import type { TransactionEvent } from '@sentinel/domain';
import type { IdempotentWriteResult } from '../../../../platform/idempotency/idempotent-write.js';

/** `transaction_events`: immutable lifecycle history, unique on idempotencyKey. Append only. */
export interface TransactionEventLog {
  append(event: TransactionEvent): Promise<IdempotentWriteResult<TransactionEvent>>;
}
