import type { EdgeEvidence, GraphEdgeKind, NodeKind } from '@sentinel/domain';

/** Renderer-agnostic scene. Any graph library renders this; none of them defines it. */
export interface GraphSceneNode {
  readonly id: string;
  readonly kind: NodeKind;
  readonly label: string;
  /** Flagged nodes carry a persistent mark, not only a colour. */
  readonly flagged: boolean;
  /** The dashed "unobserved downstream" node where a trace stops. */
  readonly unobserved: boolean;
}

export interface GraphSceneEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly kind: GraphEdgeKind;
  readonly evidence: EdgeEvidence;
}

export interface GraphScene {
  readonly nodes: readonly GraphSceneNode[];
  readonly edges: readonly GraphSceneEdge[];
}

export interface NodePosition {
  readonly x: number;
  readonly y: number;
}

export interface PositionedGraphScene extends GraphScene {
  readonly positions: Readonly<Record<string, NodePosition>>;
}
