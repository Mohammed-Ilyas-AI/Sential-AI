import type { DecisionRecord } from '@sentinel/domain';
import type { IdempotentWriteResult } from '../../../../platform/idempotency/idempotent-write.js';

/** `decisions`, unique on idempotencyKey. A retry returns the stored record; a decision is never updated. */
export interface DecisionRepository {
  findByIdempotencyKey(idempotencyKey: string): Promise<DecisionRecord | null>;
  /** Read side for case files: the decision recorded for a transaction, if any. */
  findByTransactionId(transactionId: string): Promise<DecisionRecord | null>;
  record(decision: DecisionRecord): Promise<IdempotentWriteResult<DecisionRecord>>;
}
