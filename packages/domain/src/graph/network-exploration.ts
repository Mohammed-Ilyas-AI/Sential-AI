import type { InstitutionId } from '../tenant/tenant-identifiers.js';
import type { TenantLens } from '../tenant/field-visibility.js';
import type { GraphEdge } from './graph-edge.js';
import type { GraphHopDepth } from './graph-neighbourhood.js';
import type { GraphNode } from './graph-node.js';

/**
 * A node as one lens may see it (T§14). Another tenant's node keeps its kind, institution, flag and hop count;
 * its reference is masked and its indicators and transaction count are withheld.
 */
export interface NetworkNodeView {
  readonly id: string;
  readonly kind: GraphNode['kind'];
  readonly institutionId?: InstitutionId;
  /** The bank's display reference for its own accounts; `••••4921` for another tenant's. */
  readonly label: string;
  readonly flagged: boolean;
  /** Empty when withheld. */
  readonly riskIndicators: readonly string[];
  /** Null when withheld. */
  readonly txCount: number | null;
  /** Hops from the root along the observed edges: always visible. */
  readonly hops: number;
  readonly masked: boolean;
}

/** An edge with its full provenance. Another tenant's value moved is withheld: the relationship only. */
export interface NetworkEdgeView extends Omit<GraphEdge, 'weight'> {
  readonly id: string;
  /** Null when withheld. */
  readonly weight: number | null;
  readonly masked: boolean;
}

/**
 * Why observation stops at a node. A boundary is a statement about what was searched, never a claim that an
 * entity or relationship exists beyond it.
 */
export type ObservationBoundaryReason =
  /** The node or edge cap stopped the search; heavier edges were kept, lighter ones dropped. */
  | 'CAPPED'
  /** The node sits at the maximum hop depth; its further edges were not explored. */
  | 'HOP_LIMIT'
  /** The last link has no valid cross-bank linkage (UNOBSERVED). */
  | 'UNOBSERVED_LINK'
  /** Another institution contributed only its own leg: downstream activity is not visible to the network. */
  | 'OUTSIDE_OBSERVED_NETWORK';

export interface ObservationBoundary {
  readonly nodeId: string;
  readonly reason: ObservationBoundaryReason;
  readonly institutionId?: InstitutionId;
}

/** GET /v1/network/:rootId/neighbourhood — up to two hops, capped at 40 nodes and 120 edges, heaviest edges first. */
export interface NetworkExploration {
  readonly rootId: string;
  readonly hopDepth: GraphHopDepth;
  readonly lens: TenantLens;
  readonly nodes: readonly NetworkNodeView[];
  readonly edges: readonly NetworkEdgeView[];
  readonly truncated: boolean;
  readonly boundaries: readonly ObservationBoundary[];
}

/** GET /v1/network/:rootId/fund-trace — an ordered path that ends where observation ends, never with an invented hop. */
export interface FundTraceView {
  readonly rootId: string;
  readonly lens: TenantLens;
  /** In path order, root first. */
  readonly hops: readonly NetworkEdgeView[];
  readonly nodes: readonly NetworkNodeView[];
  readonly observability: {
    readonly complete: boolean;
    readonly boundary?: InstitutionId;
    readonly observedHops: number;
    /** Present whenever `complete` is false. */
    readonly reason?: ObservationBoundaryReason | 'NO_OUTFLOW_OBSERVED' | 'CYCLE_DETECTED';
  };
}
