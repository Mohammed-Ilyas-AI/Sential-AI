import type { EdgeEvidence, GraphEdgeKind, NodeKind } from '@sentinel/domain';

/** Renderer-agnostic scene built from the evidence bundle's neighbourhood. */
export interface GraphSceneNode {
  readonly id: string;
  readonly kind: NodeKind;
  readonly label: string;
  /** Flagged nodes carry a persistent mark, not only a colour. */
  readonly flagged: boolean;
  /** Hops from the account under investigation: 0, 1 or 2. */
  readonly hop: number;
  readonly institutionId?: string;
  readonly riskIndicators: readonly string[];
  readonly txCount: number;
}

export interface GraphSceneEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly kind: GraphEdgeKind;
  /** Minor units moved for TRANSFERRED_TO, otherwise an event count. */
  readonly weight: number;
  readonly evidence: EdgeEvidence;
}

export interface NodePosition {
  readonly x: number;
  readonly y: number;
}

export interface PositionedGraphScene {
  readonly rootId: string;
  readonly nodes: readonly GraphSceneNode[];
  readonly edges: readonly GraphSceneEdge[];
  readonly positions: Readonly<Record<string, NodePosition>>;
  readonly truncated: boolean;
}
