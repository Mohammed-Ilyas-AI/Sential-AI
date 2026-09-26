import type { Alert } from '@sentinel/domain';
import type { CollectionDefinition, MongoDocument } from './collection-definition.js';

/** The open alert queue. Watched by sentinel-stream. */
export type AlertDocument = MongoDocument<Alert>;

export const alertsCollection: CollectionDefinition = {
  name: 'alerts',
  indexes: [
    { key: { status: 1, score: -1 }, name: 'status_score' },
    { key: { accountId: 1 }, name: 'accountId' },
  ],
};
