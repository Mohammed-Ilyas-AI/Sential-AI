import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Store } from '@ngrx/store';
import type { GraphNeighbourhood, InvestigationEvidence } from '@sentinel/domain';
import { CoreApiClient } from '../../../core/http/api-client/core-api-client';
import { selectFocusedDecision } from '../../../state/account-focus/account-focus.selectors';
import type { GraphSceneEdge, GraphSceneNode, NodePosition, PositionedGraphScene } from '../models/graph-scene';

export const SCENE_SIZE = { width: 760, height: 520 } as const;
const RING_RADIUS = [0, 150, 245] as const;

/** Hop distance from the root over undirected edges: the neighbourhood is already capped at two hops. */
function hopsFrom(rootId: string, neighbourhood: GraphNeighbourhood): ReadonlyMap<string, number> {
  const adjacent = new Map<string, string[]>();
  for (const edge of neighbourhood.edges) {
    adjacent.set(edge.from, [...(adjacent.get(edge.from) ?? []), edge.to]);
    adjacent.set(edge.to, [...(adjacent.get(edge.to) ?? []), edge.from]);
  }
  const hops = new Map<string, number>([[rootId, 0]]);
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const next of adjacent.get(current) ?? []) {
      if (!hops.has(next)) {
        hops.set(next, (hops.get(current) ?? 0) + 1);
        queue.push(next);
      }
    }
  }
  return hops;
}

/** Concentric rings by hop: the account at the centre, direct links on the first ring, second hop outside. */
export function layoutNeighbourhood(neighbourhood: GraphNeighbourhood): PositionedGraphScene {
  const hops = hopsFrom(neighbourhood.rootId, neighbourhood);
  const nodes: GraphSceneNode[] = neighbourhood.nodes.map((node) => ({
    id: node.id,
    kind: node.kind,
    label: node.id.replace(/^(acct|acc|dev|ben|pay)_tok_/, '').slice(0, 10),
    flagged: node.flagged,
    hop: Math.min(hops.get(node.id) ?? 2, 2),
    ...(node.institutionId ? { institutionId: node.institutionId } : {}),
    riskIndicators: node.riskIndicators,
    txCount: node.txCount,
  }));
  const positions: Record<string, NodePosition> = {};
  const centre = { x: SCENE_SIZE.width / 2, y: SCENE_SIZE.height / 2 };
  for (const hop of [0, 1, 2] as const) {
    const ring = nodes.filter((node) => node.hop === hop);
    ring.forEach((node, index) => {
      const angle = (index / Math.max(ring.length, 1)) * 2 * Math.PI - Math.PI / 2 + hop * 0.35;
      positions[node.id] = { x: centre.x + RING_RADIUS[hop] * Math.cos(angle), y: centre.y + RING_RADIUS[hop] * Math.sin(angle) * 0.82 };
    });
  }
  const edges: GraphSceneEdge[] = neighbourhood.edges
    .filter((edge) => positions[edge.from] && positions[edge.to])
    .map((edge, index) => ({ id: `e${index}`, from: edge.from, to: edge.to, kind: edge.kind, weight: edge.weight, evidence: edge.evidence }));
  return { rootId: neighbourhood.rootId, nodes, edges, positions, truncated: neighbourhood.truncated };
}

type LoadState = 'IDLE' | 'LOADING' | 'READY' | 'FAILED';

/**
 * The cross-institutional neighbourhood of the account in focus, exactly as the evidence bundle holds it (M§5.5).
 * Synthetic, privacy-safe identifiers; links that may not score are still drawn and labelled as such.
 */
@Injectable()
export class NetworkAnalysisFacade {
  private readonly core = inject(CoreApiClient);
  readonly decision = inject(Store).selectSignal(selectFocusedDecision);
  private readonly assessmentId = computed(() => this.decision()?.assessmentId ?? null);
  private readonly state = signal<{ readonly status: LoadState; readonly scene: PositionedGraphScene | null }>({ status: 'IDLE', scene: null });

  readonly status = computed(() => this.state().status);
  readonly scene = computed(() => this.state().scene);
  readonly selectedId = signal<string | null>(null);
  readonly selectedNode = computed(() => this.scene()?.nodes.find((node) => node.id === this.selectedId()) ?? null);
  readonly selectedEdges = computed(() => {
    const id = this.selectedId();
    return this.scene()?.edges.filter((edge) => edge.from === id || edge.to === id) ?? [];
  });
  /** Where the money went: transfers out of the account, largest first. */
  readonly moneyTrail = computed(() => {
    const scene = this.scene();
    if (!scene) return [];
    const byId = new Map(scene.nodes.map((node) => [node.id, node]));
    return scene.edges
      .filter((edge) => edge.kind === 'TRANSFERRED_TO')
      .map((edge) => ({ edge, from: byId.get(edge.from), to: byId.get(edge.to) }))
      .sort((left, right) => right.edge.weight - left.edge.weight);
  });
  readonly flaggedCount = computed(() => this.scene()?.nodes.filter((node) => node.flagged).length ?? 0);

  constructor() {
    effect(() => {
      const assessmentId = this.assessmentId();
      untracked(() => this.load(assessmentId));
    });
  }

  select(nodeId: string): void {
    this.selectedId.update((current) => (current === nodeId ? null : nodeId));
  }

  private load(assessmentId: string | null): void {
    this.selectedId.set(null);
    if (!assessmentId) {
      this.state.set({ status: 'IDLE', scene: null });
      return;
    }
    this.state.set({ status: 'LOADING', scene: null });
    this.core.get<InvestigationEvidence>(`/v1/investigations/${encodeURIComponent(assessmentId)}/evidence`).subscribe({
      next: ({ assessmentId: loaded, evidence }) => {
        if (loaded === this.assessmentId()) this.state.set({ status: 'READY', scene: layoutNeighbourhood(evidence.neighbourhood) });
      },
      error: () => this.state.set({ status: 'FAILED', scene: null }),
    });
  }
}
