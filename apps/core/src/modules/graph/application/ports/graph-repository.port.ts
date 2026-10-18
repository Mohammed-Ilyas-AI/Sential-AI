import type { GraphEdge, GraphNode, NetworkObservation } from '@sentinel/domain';

/** A node as stored, with the owning bank's display reference when the node is one of its accounts. */
export interface StoredGraphNode extends GraphNode {
  readonly displayReference?: string;
}

/**
 * `entities` and `entity_edges` (every edge carries its EdgeEvidence), plus the account's own settled transfers
 * from `transactions`. Read primitives only: the traversal, caps and boundaries live in GraphService.
 */
export interface GraphRepository {
  recordObservation(observation: NetworkObservation): Promise<void>;
  /** Observed edges touching any of the ids, heaviest first, at most `limit`. */
  edgesTouching(ids: readonly string[], limit: number): Promise<readonly GraphEdge[]>;
  /** Observed TRANSFERRED_TO edges leaving any of the ids. */
  transfersFrom(ids: readonly string[]): Promise<readonly GraphEdge[]>;
  /**
   * The account's own authorised or settled outflows, one DIRECT edge per destination, summed in minor units.
   * These are the bank's own records; a held or cancelled transfer moved nothing and is not an edge.
   */
  ownTransfersFrom(accountId: string): Promise<readonly GraphEdge[]>;
  /** Stored nodes for the ids, falling back to the bank-reported account for an id that is not a graph entity. */
  nodes(ids: readonly string[]): Promise<readonly StoredGraphNode[]>;
}
