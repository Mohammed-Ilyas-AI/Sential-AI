import type { Case } from '@sentinel/domain';
import type { CollectionDefinition, MongoDocument } from './collection-definition.js';

/** Investigation state and schema-validated Gemini output. */
export type CaseDocument = MongoDocument<Case>;

export const casesCollection: CollectionDefinition = {
  name: 'cases',
  indexes: [
    { key: { accountId: 1 }, name: 'accountId' },
    { key: { alertIds: 1 }, name: 'alertIds', unique: true },
  ],
};
