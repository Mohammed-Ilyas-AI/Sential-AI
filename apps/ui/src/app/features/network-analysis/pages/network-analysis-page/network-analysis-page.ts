import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import type { GraphEdgeKind, NodeKind } from '@sentinel/domain';
import { Icon } from '../../../../shared/ui/icon/icon';
import { EntityInspector } from '../../components/entity-inspector/entity-inspector';
import { FlowTimeline } from '../../components/flow-timeline/flow-timeline';
import { GraphCanvas } from '../../components/graph-canvas/graph-canvas';
import { TraceFundsControl } from '../../components/trace-funds-control/trace-funds-control';
import { NetworkAnalysisFacade, type DateRange, type GraphFilters, type RiskFilter, type StatusFilter } from '../../data-access/network-analysis-facade';
import type { GraphTarget } from '../../graph-engine/graph-renderer';

interface FilterOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

/**
 * Network analysis (M§5.5): the entity graph around one case, built from the evidence sentinel-core compiles for
 * it, on synthetic data. Entities and relationships appear only where a record supports them; candidate links are
 * drawn as candidates. The policy gate's decisions are shown as recorded, never re-derived.
 */
@Component({
  selector: 'sentinel-network-analysis-page',
  imports: [Icon, GraphCanvas, EntityInspector, FlowTimeline, TraceFundsControl],
  providers: [NetworkAnalysisFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './network-analysis-page.html',
  styleUrl: './network-analysis-page.css',
})
export class NetworkAnalysisPage {
  protected readonly facade = inject(NetworkAnalysisFacade);
  /** Bumped for a new case and for Reset: the graph re-frames, the case stays. */
  protected readonly framing = signal(0);

  protected readonly entityOptions: readonly FilterOption<'ALL' | NodeKind>[] = [
    { value: 'ALL', label: 'All entities' },
    { value: 'ACCOUNT', label: 'Accounts' },
    { value: 'PAYEE', label: 'Beneficiaries' },
    { value: 'DEVICE', label: 'Devices' },
    { value: 'INSTITUTION', label: 'Banks / institutions' },
  ];
  protected readonly relationOptions: readonly FilterOption<'ALL' | GraphEdgeKind>[] = [
    { value: 'ALL', label: 'All relations' },
    { value: 'TRANSFERRED_TO', label: 'Fund transfers' },
    { value: 'PAYEE_OF', label: 'Beneficiary links' },
    { value: 'USED_DEVICE', label: 'Device links' },
    { value: 'HELD_AT', label: 'Held at' },
  ];
  protected readonly rangeOptions: readonly FilterOption<DateRange>[] = [
    { value: 'ALL', label: 'All recorded' },
    { value: '24H', label: 'Last 24 hours' },
    { value: '7D', label: 'Last 7 days' },
    { value: '30D', label: 'Last 30 days' },
  ];
  protected readonly riskOptions: readonly FilterOption<RiskFilter>[] = [
    { value: 'ALL', label: 'All risk levels' },
    { value: 'ELEVATED', label: 'Elevated and above' },
    { value: 'HIGH', label: 'High and held' },
  ];
  protected readonly statusOptions: readonly FilterOption<StatusFilter>[] = [
    { value: 'ALL', label: 'All statuses' },
    { value: 'HOLD', label: 'On hold' },
    { value: 'RELEASED', label: 'Released' },
    { value: 'REVIEW', label: 'Allowed, high risk' },
    { value: 'ALLOWED', label: 'Allowed' },
  ];

  protected readonly counts = computed(() => {
    const scene = this.facade.scene();
    return scene ? { nodes: scene.nodes.length, edges: scene.edges.length } : null;
  });

  constructor() {
    effect(() => {
      void this.facade.selectedCase()?.assessmentId;
      this.facade.status();
      untracked(() => this.framing.update((value) => value + 1));
    });
  }

  protected setFilter(key: keyof GraphFilters, value: string): void {
    this.facade.setFilter(key, value as never);
  }

  protected select(target: GraphTarget | null): void {
    if (target) this.facade.select(target);
    else this.facade.clearFocus();
  }

  /** Reset: no focus, whole graph framed. The case and the filters stay as chosen. */
  protected resetView(): void {
    this.facade.clearFocus();
    this.framing.update((value) => value + 1);
  }

  protected search(event: Event): void {
    event.preventDefault();
    const match = this.facade.matches()[0];
    if (match) this.facade.select({ kind: 'node', id: match.id });
  }
}
