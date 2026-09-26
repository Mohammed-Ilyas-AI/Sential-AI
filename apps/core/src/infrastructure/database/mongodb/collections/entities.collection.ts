import type { GraphNode } from '@sentinel/domain';
import type { CollectionDefinition, MongoDocument } from './collection-definition.js';

/** Graph nodes: tokens and provenance only, never identity data. */
export type EntityDocument = MongoDocument<GraphNode>;

export const entitiesCollection: CollectionDefinition = {
  name: 'entities',
  indexes: [{ key: { flagged: 1 }, name: 'flagged' }],
};
