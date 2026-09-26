import type { GraphEdge } from './graph-edge.js';
import type { GraphNode } from './graph-node.js';

export type GraphHopDepth = 1 | 2;

/** Up to two hops from the root, capped at 40 nodes and 120 edges, ranked by edge weight. */
export interface GraphNeighbourhood {
  readonly rootId: string;
  readonly hopDepth: GraphHopDepth;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  /** True when the caps dropped the least significant edges. */
  readonly truncated: boolean;
}
