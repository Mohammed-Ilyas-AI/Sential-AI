import type { Intervention } from '@sentinel/domain';
import type { CollectionDefinition, MongoDocument } from './collection-definition.js';

/** Append-only audit log. `ordinal` is the record's position in its transaction's history. Watched by sentinel-stream. */
export type InterventionDocument = MongoDocument<Intervention & { readonly ordinal: number }>;

export const interventionsCollection: CollectionDefinition = {
  name: 'interventions',
  indexes: [
    { key: { accountId: 1, actedAt: -1 }, name: 'accountId_actedAt' },
    { key: { transactionId: 1, ordinal: 1 }, name: 'transactionId_ordinal', unique: true },
    { key: { state: 1, holdUntil: 1 }, name: 'state_holdUntil' },
  ],
};
