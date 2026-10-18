import type { DecisionRecord } from '@sentinel/domain';
import type { CollectionDefinition, MongoDocument } from './collection-definition.js';

/** DecisionResponse records. Watched by sentinel-stream as the primary source of the scored live tape. */
export type DecisionDocument = MongoDocument<DecisionRecord>;

export const decisionsCollection: CollectionDefinition = {
  name: 'decisions',
  indexes: [
    { key: { idempotencyKey: 1 }, name: 'idempotencyKey_unique', unique: true },
    { key: { accountId: 1, decidedAt: -1 }, name: 'accountId_decidedAt' },
    { key: { transactionId: 1 }, name: 'transactionId' },
  ],
};
