import type { GraphEdge } from '@sentinel/domain';
import type { CollectionDefinition, MongoDocument } from './collection-definition.js';

/** Graph edges, each carrying its EdgeEvidence. _id is from|to|kind, so an observation upserts idempotently. */
export type EntityEdgeDocument = MongoDocument<GraphEdge>;

export const edgeIdentity = (edge: Pick<GraphEdge, 'from' | 'to' | 'kind'>): string => `${edge.from}|${edge.to}|${edge.kind}`;

export const entityEdgesCollection: CollectionDefinition = {
  name: 'entity_edges',
  indexes: [
    { key: { from: 1 }, name: 'from' },
    { key: { to: 1 }, name: 'to' },
  ],
};
