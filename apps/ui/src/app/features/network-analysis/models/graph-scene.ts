import type { Decision, EdgeEvidence, GraphEdgeKind, InterventionState, MinorUnits, NodeKind, RiskBand } from '@sentinel/domain';

/** How a node or edge reads at a glance: the gate's own outcome where one exists, never inferred. */
export type GraphTone = 'held' | 'high' | 'elevated' | 'normal' | 'neutral';

/** Renderer-agnostic scene. The canvas renderer draws this; it never defines it. */
export interface GraphSceneNode {
  readonly id: string;
  readonly kind: NodeKind;
  readonly label: string;
  /** Second line under the label: institution, entity type or event. */
  readonly caption: string;
  readonly tone: GraphTone;
  /** The account the case is about. */
  readonly root: boolean;
  /** Flagged nodes carry a persistent mark, not only a colour. */
  readonly flagged: boolean;
  /** Why the node is flagged, in the evidence's own words (for example "new device"). */
  readonly flags: readonly string[];
  /** The dashed "unobserved downstream" node where a trace stops. */
  readonly unobserved: boolean;
  readonly institutionId?: string;
}

/** One transfer behind a relationship, as the evidence and the live tape record it. */
export interface GraphTransfer {
  readonly id: string;
  readonly at: string;
  readonly amount: MinorUnits;
  readonly from: string;
  readonly to: string;
  readonly payeeId: string;
  readonly deviceId: string;
  readonly destInstitutionId: string;
  /** The gate's recorded outcome, when the transfer is still on the live tape. */
  readonly decided?: { readonly score: number; readonly band: RiskBand; readonly decision: Decision };
  /** The latest intervention state, when one was recorded. A HOLD decision may since have been RELEASED. */
  readonly intervention?: InterventionState;
}

export interface GraphSceneEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly kind: GraphEdgeKind;
  readonly tone: GraphTone;
  /** Short text drawn on the edge, for example "2 transfers · S$9,400.00". */
  readonly label: string;
  readonly evidence: EdgeEvidence;
  /** Transfers that establish this edge, oldest first; empty for device and registration links. */
  readonly transfers: readonly string[];
  readonly firstSeen: string;
  readonly lastSeen: string;
  /** Total value in minor units for transfers, else event count. */
  readonly weight: number;
}

export interface GraphScene {
  readonly rootId: string | null;
  readonly nodes: readonly GraphSceneNode[];
  readonly edges: readonly GraphSceneEdge[];
  readonly transfers: readonly GraphTransfer[];
  /** True when the core's neighbourhood query dropped its least significant edges. */
  readonly truncated: boolean;
}

export interface NodePosition {
  readonly x: number;
  readonly y: number;
}

export interface PositionedGraphScene extends GraphScene {
  readonly positions: Readonly<Record<string, NodePosition>>;
}
