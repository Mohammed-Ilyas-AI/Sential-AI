import type { TransactionEvent } from '@sentinel/domain';
import type { CollectionDefinition, MongoDocument } from './collection-definition.js';

/** Immutable lifecycle history. _id is the eventId. */
export type TransactionEventDocument = MongoDocument<TransactionEvent>;

export const transactionEventsCollection: CollectionDefinition = {
  name: 'transaction_events',
  indexes: [
    { key: { idempotencyKey: 1 }, name: 'idempotencyKey_unique', unique: true },
    { key: { transactionId: 1, accountSequence: 1 }, name: 'transactionId_accountSequence' },
  ],
};
