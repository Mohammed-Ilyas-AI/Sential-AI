import type { TransactionProjection } from '@sentinel/domain';
import type { CollectionDefinition, MongoDocument } from './collection-definition.js';

/** The materialised financial projection. _id is the transactionId: one document per payment. */
export type TransactionProjectionDocument = MongoDocument<TransactionProjection>;

export const transactionsCollection: CollectionDefinition = {
  name: 'transactions',
  indexes: [
    { key: { sourceAccountId: 1, ts: -1 }, name: 'sourceAccountId_ts' },
    { key: { sourceAccountId: 1, drainExcluded: 1, ts: -1 }, name: 'sourceAccountId_drainExcluded_ts' },
  ],
};
