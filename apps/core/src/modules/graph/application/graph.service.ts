import {
  GRAPH_EDGE_CAP,
  GRAPH_NODE_CAP,
  type FundTraceView,
  type GraphEdge,
  type GraphHopDepth,
  type NetworkExploration,
  type NetworkObservation,
  type NodeKind,
  type ObservationBoundary,
  type TenantLens,
} from '@sentinel/domain';
import { ApplicationError } from '../../../platform/errors/application-error.js';
import type { ExploreNetwork } from './explore-network.use-case.js';
import { edgeIdOf, projectEdge, projectNode } from './network-projection.js';
import type { GraphRepository, StoredGraphNode } from './ports/graph-repository.port.js';
import type { RecordNetworkObservation } from './record-network-observation.use-case.js';

/** Heaviest first; ties by first observation, then identity, so the same data always yields the same graph. */
const byWeight = (left: GraphEdge, right: GraphEdge): number =>
  right.weight - left.weight || left.firstSeen.localeCompare(right.firstSeen) || edgeIdOf(left).localeCompare(edgeIdOf(right));

/** What a node is, read from the edge that reaches it, when the node itself was never observed as an entity. */
const KIND_AT_TARGET: Readonly<Record<GraphEdge['kind'], NodeKind>> = {
  TRANSFERRED_TO: 'ACCOUNT',
  USED_DEVICE: 'DEVICE',
  PAYEE_OF: 'PAYEE',
  HELD_AT: 'INSTITUTION',
};

/**
 * The server-side entity graph (M§5.5, T§8). Two hops from the root over the observed edges, heaviest first,
 * capped at GRAPH_NODE_CAP nodes and GRAPH_EDGE_CAP edges, plus the root account's own settled transfers. A fund
 * trace follows the heaviest observed outflow and stops where observation stops. Nothing here writes an edge,
 * so ENTITY_LINK scoring is untouched; nothing here calls a model.
 */
export class GraphService implements ExploreNetwork, RecordNetworkObservation {
  constructor(private readonly graph: GraphRepository) {}

  record(observation: NetworkObservation): Promise<void> {
    return this.graph.recordObservation(observation);
  }

  async neighbourhood(rootId: string, hopDepth: GraphHopDepth, lens: TenantLens): Promise<NetworkExploration> {
    await this.requireRoot(rootId);
    const hops = new Map<string, number>([[rootId, 0]]);
    const edges = new Map<string, GraphEdge>();
    const boundaries = new Map<string, ObservationBoundary>();
    let truncated = false;
    let frontier = [rootId];

    for (let hop = 0; hop < hopDepth && frontier.length > 0; hop += 1) {
      const own = hop === 0 ? await this.graph.ownTransfersFrom(rootId) : [];
      const observed = await this.graph.edgesTouching(frontier, GRAPH_EDGE_CAP + 1);
      const found = [...new Map([...own, ...observed].map((edge) => [edgeIdOf(edge), edge])).values()].sort(byWeight);
      const next: string[] = [];
      for (const edge of found) {
        for (const id of [edge.from, edge.to]) {
          if (hops.has(id)) continue;
          if (hops.size >= GRAPH_NODE_CAP) {
            truncated = true;
            const reached = id === edge.from ? edge.to : edge.from;
            if (hops.has(reached)) boundaries.set(reached, { nodeId: reached, reason: 'CAPPED' });
            continue;
          }
          hops.set(id, hop + 1);
          next.push(id);
        }
        if (!hops.has(edge.from) || !hops.has(edge.to) || edges.has(edgeIdOf(edge))) continue;
        if (edges.size >= GRAPH_EDGE_CAP) {
          truncated = true;
          continue;
        }
        edges.set(edgeIdOf(edge), edge);
        if (edge.evidence.linkage === 'UNOBSERVED') {
          boundaries.set(edge.to, { nodeId: edge.to, reason: 'UNOBSERVED_LINK' });
        }
      }
      frontier = next;
    }

    // Nodes at the hop limit whose further edges were not explored: the search stopped there, by design.
    if (frontier.length > 0) {
      for (const edge of await this.graph.edgesTouching(frontier, GRAPH_EDGE_CAP)) {
        for (const [near, far] of [[edge.from, edge.to], [edge.to, edge.from]] as const) {
          if (frontier.includes(near) && !hops.has(far) && !boundaries.has(near)) boundaries.set(near, { nodeId: near, reason: 'HOP_LIMIT' });
        }
      }
    }

    const nodes = await this.nodesFor([...hops.keys()], [...edges.values()]);
    const institutions = new Map(nodes.map((node) => [node.id, node.institutionId]));
    return {
      rootId,
      hopDepth,
      lens,
      nodes: nodes.map((node) => projectNode(lens, node, hops.get(node.id) ?? 0)),
      edges: [...edges.values()].map((edge) => projectEdge(lens, edge)),
      truncated,
      boundaries: [...boundaries.values()].map((boundary) => {
        const institutionId = institutions.get(boundary.nodeId);
        return institutionId ? { ...boundary, institutionId } : boundary;
      }),
    };
  }

  async traceFunds(rootId: string, lens: TenantLens, via?: string): Promise<FundTraceView> {
    const root = await this.requireRoot(rootId);
    const path: GraphEdge[] = [];
    const visited = new Set([rootId]);
    let current = rootId;
    let stop: 'UNOBSERVED_LINK' | 'CYCLE_DETECTED' | 'CAPPED' | null = null;

    while (path.length < GRAPH_NODE_CAP) {
      const own = current === rootId ? await this.graph.ownTransfersFrom(rootId) : [];
      const observed = await this.graph.transfersFrom([current]);
      const next = [...own, ...observed]
        .filter((edge) => edge.from === current && edge.kind === 'TRANSFERRED_TO' && (via === undefined || current !== rootId || edge.to === via))
        .sort(byWeight)[0];
      if (!next) break;
      if (visited.has(next.to)) {
        stop = 'CYCLE_DETECTED';
        break;
      }
      path.push(next);
      visited.add(next.to);
      current = next.to;
      if (next.evidence.linkage === 'UNOBSERVED') {
        stop = 'UNOBSERVED_LINK';
        break;
      }
    }
    if (stop === null && path.length >= GRAPH_NODE_CAP) stop = 'CAPPED';

    const nodes = await this.nodesFor([...visited], path);
    const hopOf = new Map([...visited].map((id, index) => [id, index]));
    const terminal = nodes.find((node) => node.id === current);
    // Complete only when every hop is the recording bank's own record and the money ends inside that bank:
    // once it reaches another institution, that bank contributed only its own leg and what follows is unseen.
    const last = path.at(-1);
    const endsInsideRecordingBank =
      last !== undefined &&
      path.every((edge) => edge.evidence.tenantScope === 'OWN') &&
      terminal?.institutionId !== undefined &&
      terminal.institutionId === last.evidence.sourceInstitution;
    const reason = path.length === 0 ? 'NO_OUTFLOW_OBSERVED' : (stop ?? (endsInsideRecordingBank ? null : 'OUTSIDE_OBSERVED_NETWORK'));
    const boundary = reason && reason !== 'NO_OUTFLOW_OBSERVED' ? (terminal?.institutionId ?? root.institutionId) : undefined;
    return {
      rootId,
      lens,
      hops: path.map((edge) => projectEdge(lens, edge)),
      nodes: nodes.map((node) => projectNode(lens, node, hopOf.get(node.id) ?? 0)),
      observability: {
        complete: reason === null,
        observedHops: path.length,
        ...(reason ? { reason } : {}),
        ...(boundary ? { boundary } : {}),
      },
    };
  }

  private async requireRoot(rootId: string): Promise<StoredGraphNode> {
    const [root] = await this.graph.nodes([rootId]);
    if (!root) throw new ApplicationError('NOT_FOUND', `${rootId} is neither an observed entity nor a reported account`);
    return root;
  }

  /** Every reached id as a node. An endpoint never observed as an entity is shown as what its edge says it is, unflagged. */
  private async nodesFor(ids: readonly string[], edges: readonly GraphEdge[]): Promise<readonly StoredGraphNode[]> {
    const stored = new Map((await this.graph.nodes(ids)).map((node) => [node.id, node]));
    return ids.map((id) => {
      const known = stored.get(id);
      if (known) return known;
      const reaching = edges.find((edge) => edge.to === id);
      return { id, kind: reaching ? KIND_AT_TARGET[reaching.kind] : 'ACCOUNT', flagged: false, riskIndicators: [], txCount: 0 };
    });
  }
}
