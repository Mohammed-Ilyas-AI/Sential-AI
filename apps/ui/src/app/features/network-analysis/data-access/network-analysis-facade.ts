import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import type { Alert, EvidenceBundle, GraphEdgeKind, InvestigationEvidence, NodeKind } from '@sentinel/domain';
import type { Observable } from 'rxjs';
import { CoreApiClient } from '../../../core/http/api-client/core-api-client';
import { AlertsActions } from '../../../state/alerts/alerts.actions';
import { alertsFeature } from '../../../state/alerts/alerts.feature';
import { transactionsFeature } from '../../../state/transactions/transactions.feature';
import { buildEvidenceGraph, type GraphTimelineEntry } from '../graph-engine/evidence-graph';
import { layoutGraph } from '../graph-engine/graph-layout';
import type { GraphTarget } from '../graph-engine/graph-renderer';
import type { GraphSceneEdge, GraphTone, GraphTransfer, PositionedGraphScene } from '../models/graph-scene';

export type LoadStatus = 'IDLE' | 'LOADING' | 'READY' | 'FAILED';
export type DateRange = 'ALL' | '24H' | '7D' | '30D';
export type RiskFilter = 'ALL' | 'ELEVATED' | 'HIGH';
export type StatusFilter = 'ALL' | 'HOLD' | 'RELEASED' | 'REVIEW' | 'ALLOWED';

export interface GraphFilters {
  readonly entity: 'ALL' | NodeKind;
  readonly relation: 'ALL' | GraphEdgeKind;
  readonly range: DateRange;
  readonly risk: RiskFilter;
  readonly status: StatusFilter;
}

const DEFAULT_FILTERS: GraphFilters = { entity: 'ALL', relation: 'ALL', range: 'ALL', risk: 'ALL', status: 'ALL' };
const RANGE_MS: Readonly<Record<Exclude<DateRange, 'ALL'>, number>> = { '24H': 86_400_000, '7D': 7 * 86_400_000, '30D': 30 * 86_400_000 };
const TONE_RANK: Readonly<Record<GraphTone, number>> = { neutral: 0, normal: 1, elevated: 2, high: 3, held: 4 };

/** A case the selector offers: one open alert, labelled the way analysts know it. */
export interface CaseOption {
  readonly alertId: string;
  readonly accountId: string;
  readonly assessmentId: string;
  readonly label: string;
}

/** The status of one transfer as the analyst reads it: current intervention state first, then the decision. */
export function transferStatus(transfer: GraphTransfer): StatusFilter | 'UNKNOWN' {
  if (transfer.intervention === 'HELD') return 'HOLD';
  if (transfer.intervention === 'RELEASED') return 'RELEASED';
  if (!transfer.decided) return 'UNKNOWN';
  if (transfer.decided.decision !== 'ALLOW') return 'HOLD';
  return transfer.decided.band === 'HIGH' || transfer.decided.band === 'CRITICAL' ? 'REVIEW' : 'ALLOWED';
}

/**
 * The Network Analysis workspace (M§5.5), route-scoped. The case is one open alert; its graph is built from the
 * evidence bundle sentinel-core compiles for that alert's assessment, joined to the live tape's recorded decisions.
 * Filters narrow what is drawn without moving anything; selection, search and the timeline all point at the same
 * stable node and edge ids.
 */
@Injectable()
export class NetworkAnalysisFacade {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly core = inject(CoreApiClient);
  private readonly queue = this.store.selectSignal(alertsFeature.selectQueue);
  private readonly focusedAccount = this.store.selectSignal(alertsFeature.selectFocusedAccountId);
  private readonly tape = this.store.selectSignal(transactionsFeature.selectTape);

  readonly cases = computed<readonly CaseOption[]>(() => {
    const tape = this.tape();
    return this.queue().map((alert: Alert) => {
      const reference = alert.accountReference ?? tape.find((row) => row.accountId === alert.accountId)?.accountReference ?? alert.accountId;
      const time = alert.raisedAt.slice(11, 16);
      return { alertId: alert.id, accountId: alert.accountId, assessmentId: alert.assessmentId, label: `${reference} · score ${alert.score} · ${time} UTC` };
    });
  });
  private readonly chosenCase = signal<string | null>(null);
  /** The chosen case, else the account already in focus elsewhere in the app, else the highest-risk alert. */
  readonly selectedCase = computed<CaseOption | null>(() => {
    const cases = this.cases();
    const chosen = this.chosenCase();
    return cases.find((option) => option.alertId === chosen) ?? cases.find((option) => option.accountId === this.focusedAccount()) ?? cases[0] ?? null;
  });

  private readonly evidenceState = signal<{ readonly status: LoadStatus; readonly assessmentId: string | null; readonly evidence: EvidenceBundle | null }>({
    status: 'IDLE',
    assessmentId: null,
    evidence: null,
  });
  readonly status = computed(() => this.evidenceState().status);

  private readonly built = computed(() => {
    const evidence = this.evidenceState().evidence;
    const option = this.selectedCase();
    if (!evidence || !option) return null;
    const tape = new Map(this.tape().map((row) => [row.transactionId, row]));
    const reference = option.label.split(' · ')[0] ?? null;
    const { scene, timeline } = buildEvidenceGraph(evidence, tape, reference);
    return { scene: layoutGraph(scene), timeline, evidence };
  });
  readonly evidence = computed(() => this.built()?.evidence ?? null);
  readonly timeline = computed<readonly GraphTimelineEntry[]>(() => this.built()?.timeline ?? []);

  readonly filters = signal<GraphFilters>(DEFAULT_FILTERS);
  /** The graph as drawn: filters narrow it, positions never move. The case account always stays. */
  readonly scene = computed<PositionedGraphScene | null>(() => {
    const full = this.built()?.scene;
    if (!full) return null;
    const filters = this.filters();
    const transfers = new Map(full.transfers.map((transfer) => [transfer.id, transfer]));
    const now = Date.now();
    const inRange = (at: string) => filters.range === 'ALL' || now - Date.parse(at) <= RANGE_MS[filters.range];
    const edgeMatches = (edge: GraphSceneEdge) => {
      if (filters.relation !== 'ALL' && edge.kind !== filters.relation) return false;
      const own = edge.transfers.map((id) => transfers.get(id)).filter((transfer): transfer is GraphTransfer => !!transfer);
      if (own.length === 0) return inRange(edge.lastSeen) && filters.status === 'ALL';
      return own.some((transfer) => inRange(transfer.at) && (filters.status === 'ALL' || transferStatus(transfer) === filters.status));
    };
    const nodeMatches = (id: string) => {
      const node = full.nodes.find((candidate) => candidate.id === id);
      if (!node) return false;
      if (node.root) return true;
      if (filters.entity !== 'ALL' && node.kind !== filters.entity) return false;
      if (filters.risk === 'ELEVATED' && TONE_RANK[node.tone] < TONE_RANK.elevated) return false;
      if (filters.risk === 'HIGH' && TONE_RANK[node.tone] < TONE_RANK.high) return false;
      return true;
    };
    const edges = full.edges.filter((edge) => edgeMatches(edge) && nodeMatches(edge.from) && nodeMatches(edge.to));
    const connected = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
    const nodes = full.nodes.filter((node) => node.root || (connected.has(node.id) && nodeMatches(node.id)));
    return { ...full, nodes, edges };
  });
  readonly filtered = computed(() => {
    const filters = this.filters();
    return (Object.keys(filters) as (keyof GraphFilters)[]).some((key) => filters[key] !== 'ALL');
  });

  readonly selection = signal<GraphTarget | null>(null);
  /** The timeline entry in focus: its nodes and edges stay bright, the rest dims. */
  readonly activeEntry = signal<string | null>(null);
  readonly highlight = computed(() => {
    const entry = this.timeline().find((candidate) => candidate.id === this.activeEntry());
    return entry ? { nodes: entry.nodeIds, edges: entry.edgeIds } : null;
  });

  readonly query = signal('');
  readonly matches = computed(() => {
    const query = this.query().trim().toLowerCase();
    const scene = this.scene();
    if (!query || !scene) return [];
    return scene.nodes.filter((node) => node.id.toLowerCase().includes(query) || node.label.toLowerCase().includes(query) || node.caption.toLowerCase().includes(query));
  });

  constructor() {
    effect(() => {
      const assessmentId = this.selectedCase()?.assessmentId ?? null;
      untracked(() => this.load(assessmentId));
    });
    // A new case starts on its account, with nothing dimmed.
    effect(() => {
      const root = this.built()?.scene.rootId ?? null;
      untracked(() => {
        if (this.selection()?.kind === 'node' && this.built()?.scene.nodes.some((node) => node.id === this.selection()?.id)) return;
        this.selection.set(root ? { kind: 'node', id: root } : null);
        this.activeEntry.set(null);
      });
    });
  }

  chooseCase(alertId: string): void {
    this.chosenCase.set(alertId);
    this.selection.set(null);
    this.activeEntry.set(null);
  }

  setFilter<K extends keyof GraphFilters>(key: K, value: GraphFilters[K]): void {
    this.filters.update((filters) => ({ ...filters, [key]: value }));
  }

  clearFilters(): void {
    this.filters.set(DEFAULT_FILTERS);
  }

  select(target: GraphTarget | null): void {
    this.selection.set(target);
  }

  /** Focus a timeline moment: highlight what it touched and select its main relationship. Again to clear. */
  focusEntry(entry: GraphTimelineEntry): void {
    if (this.activeEntry() === entry.id) {
      this.activeEntry.set(null);
      return;
    }
    this.activeEntry.set(entry.id);
    const edge = entry.edgeIds.find((id) => this.scene()?.edges.some((candidate) => candidate.id === id));
    if (edge) this.selection.set({ kind: 'edge', id: edge });
  }

  clearFocus(): void {
    this.activeEntry.set(null);
    const root = this.scene()?.rootId ?? null;
    this.selection.set(root ? { kind: 'node', id: root } : null);
  }

  /** The case account, or the selected account when it has its own decision on the tape, opens in Investigations. */
  openInvestigation(): void {
    const option = this.selectedCase();
    if (!option) return;
    const selected = this.selection();
    const onTape = selected?.kind === 'node' && this.tape().some((row) => row.accountId === selected.id);
    const accountId = onTape && selected ? selected.id : option.accountId;
    this.store.dispatch(AlertsActions.accountSelected({ accountId }));
    void this.router.navigateByUrl('/investigations');
  }

  private load(assessmentId: string | null): void {
    if (!assessmentId) {
      this.evidenceState.set({ status: 'IDLE', assessmentId: null, evidence: null });
      return;
    }
    if (this.evidenceState().assessmentId === assessmentId && this.evidenceState().status !== 'FAILED') return;
    this.evidenceState.set({ status: 'LOADING', assessmentId, evidence: null });
    this.fetch(assessmentId).subscribe({
      next: ({ assessmentId: loaded, evidence }) => {
        if (loaded === this.selectedCase()?.assessmentId) this.evidenceState.set({ status: 'READY', assessmentId: loaded, evidence });
      },
      error: () => this.evidenceState.set({ status: 'FAILED', assessmentId, evidence: null }),
    });
  }

  private fetch(assessmentId: string): Observable<InvestigationEvidence> {
    return this.core.get<InvestigationEvidence>(`/v1/investigations/${encodeURIComponent(assessmentId)}/evidence`);
  }
}
