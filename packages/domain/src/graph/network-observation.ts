import type { GraphEdge } from './graph-edge.js';
import type { GraphNode } from './graph-node.js';

/**
 * Body of POST /v1/network/observations: tokenised, permitted nodes and edges contributed by participating
 * institutions. Every edge carries its EdgeEvidence. Idempotent upsert.
 */
export interface NetworkObservation {
  readonly schemaVersion: '1.0';
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}
