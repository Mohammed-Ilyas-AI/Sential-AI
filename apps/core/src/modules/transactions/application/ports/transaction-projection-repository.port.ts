import type { TransactionProjection } from '@sentinel/domain';

/** `transactions`: the materialised financial projection, one document per transactionId. */
export interface TransactionProjectionRepository {
  findByTransactionId(transactionId: string): Promise<TransactionProjection | null>;
  upsert(projection: TransactionProjection): Promise<void>;
}
