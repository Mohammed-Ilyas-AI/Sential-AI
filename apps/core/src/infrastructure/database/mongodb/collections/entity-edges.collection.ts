import type { GraphEdge } from '@sentinel/domain';
import type { CollectionDefinition, MongoDocument } from './collection-definition.js';

/** Graph edges, each carrying its EdgeEvidence. Two-hop traversal is one $graphLookup with maxDepth 1. */
export type EntityEdgeDocument = MongoDocument<GraphEdge>;

export const entityEdgesCollection: CollectionDefinition = {
  name: 'entity_edges',
  indexes: [
    { key: { from: 1 }, name: 'from' },
    { key: { to: 1 }, name: 'to' },
  ],
};
