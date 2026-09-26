import type { Intervention } from '@sentinel/domain';
import type { CollectionDefinition, MongoDocument } from './collection-definition.js';

/** Append-only audit log. Watched by sentinel-stream. */
export type InterventionDocument = MongoDocument<Intervention>;

export const interventionsCollection: CollectionDefinition = {
  name: 'interventions',
  indexes: [
    { key: { accountId: 1, actedAt: -1 }, name: 'accountId_actedAt' },
    { key: { transactionId: 1, actedAt: 1 }, name: 'transactionId_actedAt' },
  ],
};
