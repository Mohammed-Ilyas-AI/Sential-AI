import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { EvidenceBundle } from '@sentinel/domain';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import { transferStatus } from '../../data-access/network-analysis-facade';
import { institutionName } from '../../graph-engine/evidence-graph';
import type { GraphTarget } from '../../graph-engine/graph-renderer';
import type { GraphSceneEdge, GraphSceneNode, GraphTone, GraphTransfer, PositionedGraphScene } from '../../models/graph-scene';

type Tab = 'overview' | 'transactions' | 'connections';

const KIND_LABEL: Readonly<Record<GraphSceneNode['kind'], string>> = { ACCOUNT: 'Account', PAYEE: 'Beneficiary', DEVICE: 'Device', INSTITUTION: 'Bank / institution' };
const RELATION_LABEL: Readonly<Record<GraphSceneEdge['kind'], string>> = {
  TRANSFERRED_TO: 'Fund transfer',
  PAYEE_OF: 'Beneficiary link',
  USED_DEVICE: 'Device link',
  HELD_AT: 'Held at',
};
const TONE_LABEL: Readonly<Record<GraphTone, string>> = { held: 'HOLD', high: 'High risk', elevated: 'Elevated', normal: 'Normal', neutral: 'No risk signal' };

/**
 * The selected entity or relationship, in the evidence's own terms. A transfer's policy decision and its current
 * intervention state are always two separate facts; a candidate link says it is a candidate.
 */
@Component({
  selector: 'sentinel-entity-inspector',
  imports: [DatePipe, DecimalPipe, Icon, MinorUnitsCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (node(); as item) {
      <header>
        <div>
          <h2 class="mono">{{ item.label }}</h2>
          <p class="caption">{{ kindLabel[item.kind] }} · {{ item.caption }}</p>
        </div>
        <button type="button" class="close" aria-label="Clear selection" title="Clear selection" (click)="cleared.emit()"><sentinel-icon name="close" [size]="16" /></button>
      </header>
      <div class="status">
        <span class="chip" [attr.data-tone]="item.tone">{{ toneLabel[item.tone] }}</span>
        @if (item.root && evidence(); as bundle) {
          <span class="score">Risk score <b>{{ bundle.assessment.score }}</b> / 100</span>
        }
      </div>
      <nav class="tabs" role="tablist">
        <button type="button" role="tab" [attr.aria-selected]="tab() === 'overview'" (click)="tab.set('overview')">Overview</button>
        <button type="button" role="tab" [attr.aria-selected]="tab() === 'transactions'" (click)="tab.set('transactions')">Transactions ({{ transfers().length }})</button>
        <button type="button" role="tab" [attr.aria-selected]="tab() === 'connections'" (click)="tab.set('connections')">Connections ({{ connections().length }})</button>
      </nav>
      <div class="body sentinel-scroll">
        @switch (tab()) {
          @case ('overview') {
            <h3>Entity details</h3>
            <dl>
              <div><dt>Entity ID</dt><dd class="mono">{{ item.id.startsWith('inst:') ? item.institutionId : item.id }}</dd></div>
              <div><dt>Type</dt><dd>{{ kindLabel[item.kind] }}</dd></div>
              @if (item.institutionId) {
                <div><dt>Institution</dt><dd>{{ institution(item.institutionId) }}</dd></div>
              }
              @if (item.root && evidence(); as bundle) {
                <div><dt>Opened</dt><dd>{{ bundle.account.openedAt | date: 'd MMM y' : 'UTC' }}</dd></div>
                <div><dt>Protected account</dt><dd>{{ bundle.account.protected ? 'Yes' : 'No' }}</dd></div>
                <div><dt>Risk score</dt><dd [attr.data-tone]="item.tone">{{ bundle.assessment.score }} ({{ bundle.assessment.band }})</dd></div>
                <div><dt>24h outflow</dt><dd>{{ bundle.drain.drainPct | number: '1.0-1' }}%</dd></div>
              }
              @if (item.unobserved) {
                <div><dt>Observation</dt><dd>Unobserved downstream</dd></div>
              }
            </dl>
            @if (item.flags.length > 0) {
              <h3>Signals</h3>
              <ul class="flags">
                @for (flag of item.flags; track flag) {
                  <li>{{ flag }}</li>
                }
              </ul>
            }
            <h3>Key relationships</h3>
            <ul class="relations">
              @for (relation of connections().slice(0, 6); track relation.edge.id) {
                <li>
                  <button type="button" (click)="selected.emit({ kind: 'node', id: relation.other.id })">
                    <span class="dot" [attr.data-kind]="relation.other.kind"></span>
                    <span class="name mono">{{ relation.other.label }}</span>
                    <span class="what">{{ relation.edge.label }}</span>
                  </button>
                </li>
              } @empty {
                <li class="empty">No relationships in the current view.</li>
              }
            </ul>
          }
          @case ('transactions') {
            <ul class="transfers">
              @for (transfer of transfers(); track transfer.id) {
                <li>
                  <span class="mono id">{{ transfer.id }}</span>
                  <span class="line"><b>{{ transfer.amount | minorUnitsCurrency }}</b> · {{ institution(transfer.destInstitutionId) }} · {{ transfer.at | date: 'd MMM, HH:mm' : 'UTC' }}</span>
                  <span class="facts">
                    <span class="fact">Decision <b>{{ transfer.decided?.decision ?? 'not on tape' }}</b></span>
                    <span class="fact" [attr.data-status]="status(transfer)">Status <b>{{ status(transfer) }}</b></span>
                  </span>
                </li>
              } @empty {
                <li class="empty">No transfers in the evidence for this entity.</li>
              }
            </ul>
          }
          @case ('connections') {
            <ul class="connections">
              @for (relation of connections(); track relation.edge.id) {
                <li>
                  <button type="button" (click)="selected.emit({ kind: 'edge', id: relation.edge.id })">
                    <span class="name"><span class="dot" [attr.data-kind]="relation.other.kind"></span><span class="mono">{{ relation.other.label }}</span></span>
                    <span class="what">{{ relationLabel[relation.edge.kind] }} · {{ relation.edge.label }}</span>
                    <span class="evidence" [attr.data-scoring]="relation.edge.evidence.scoring">{{ relation.edge.evidence.scoring.toLowerCase() }} · {{ relation.edge.evidence.linkage.toLowerCase().replace('_', ' ') }}</span>
                  </button>
                </li>
              } @empty {
                <li class="empty">No relationships in the current view.</li>
              }
            </ul>
          }
        }
      </div>
    } @else if (edge(); as link) {
      <header>
        <div>
          <h2>{{ relationLabel[link.kind] }}</h2>
          <p class="caption">{{ link.label }}</p>
        </div>
        <button type="button" class="close" aria-label="Clear selection" title="Clear selection" (click)="cleared.emit()"><sentinel-icon name="close" [size]="16" /></button>
      </header>
      <div class="status">
        <span class="chip" [attr.data-tone]="link.tone">{{ toneLabel[link.tone] }}</span>
        <span class="chip" [attr.data-scoring]="link.evidence.scoring">{{ link.evidence.scoring === 'CONFIRMED' ? 'Confirmed' : link.evidence.scoring.toLowerCase() }}</span>
      </div>
      <div class="body sentinel-scroll">
        <h3>Relationship evidence</h3>
        <dl>
          <div><dt>From</dt><dd class="mono"><button type="button" class="link" (click)="selected.emit({ kind: 'node', id: link.from })">{{ labelOf(link.from) }}</button></dd></div>
          <div><dt>To</dt><dd class="mono"><button type="button" class="link" (click)="selected.emit({ kind: 'node', id: link.to })">{{ labelOf(link.to) }}</button></dd></div>
          <div><dt>Evidence</dt><dd>{{ link.evidence.evidenceType.replaceAll('_', ' ').toLowerCase() }}</dd></div>
          <div><dt>Recorded by</dt><dd>{{ institution(link.evidence.sourceInstitution) }} ({{ link.evidence.tenantScope === 'OWN' ? 'own record' : 'network' }})</dd></div>
          <div><dt>Linkage</dt><dd>{{ link.evidence.linkage.replace('_', ' ').toLowerCase() }}</dd></div>
          <div><dt>First seen</dt><dd>{{ link.firstSeen | date: 'd MMM y, HH:mm' : 'UTC' }}</dd></div>
          <div><dt>Last seen</dt><dd>{{ link.lastSeen | date: 'd MMM y, HH:mm' : 'UTC' }}</dd></div>
        </dl>
        <h3>Transfers behind this link ({{ transfers().length }})</h3>
        <ul class="transfers">
          @for (transfer of transfers(); track transfer.id) {
            <li>
              <span class="mono id">{{ transfer.id }}</span>
              <span class="line"><b>{{ transfer.amount | minorUnitsCurrency }}</b> · {{ transfer.at | date: 'd MMM, HH:mm' : 'UTC' }}</span>
              <span class="facts">
                <span class="fact">Decision <b>{{ transfer.decided?.decision ?? 'not on tape' }}</b></span>
                <span class="fact" [attr.data-status]="status(transfer)">Status <b>{{ status(transfer) }}</b></span>
              </span>
            </li>
          } @empty {
            <li class="empty">This link is a registration or device event, not a transfer.</li>
          }
        </ul>
      </div>
    } @else {
      <p class="empty placeholder">Select an entity or relationship on the graph to inspect it.</p>
    }
    <button type="button" class="open" [disabled]="!canOpen()" (click)="openInvestigation.emit()">
      Open in investigation <sentinel-icon name="arrowRight" [size]="16" />
    </button>
  `,
  styleUrl: './entity-inspector.css',
})
export class EntityInspector {
  readonly scene = input<PositionedGraphScene | null>(null);
  readonly selection = input<GraphTarget | null>(null);
  readonly evidence = input<EvidenceBundle | null>(null);
  readonly canOpen = input(false);
  readonly selected = output<GraphTarget>();
  readonly cleared = output<void>();
  readonly openInvestigation = output<void>();

  protected readonly tab = signal<Tab>('overview');
  protected readonly kindLabel = KIND_LABEL;
  protected readonly relationLabel = RELATION_LABEL;
  protected readonly toneLabel = TONE_LABEL;
  protected readonly institution = institutionName;
  protected readonly status = (transfer: GraphTransfer) => {
    const status = transferStatus(transfer);
    return status === 'UNKNOWN' ? 'not on tape' : status;
  };

  protected readonly node = computed(() => {
    const selection = this.selection();
    return selection?.kind === 'node' ? (this.scene()?.nodes.find((node) => node.id === selection.id) ?? null) : null;
  });
  protected readonly edge = computed(() => {
    const selection = this.selection();
    return selection?.kind === 'edge' ? (this.scene()?.edges.find((edge) => edge.id === selection.id) ?? null) : null;
  });

  protected readonly connections = computed(() => {
    const node = this.node();
    const scene = this.scene();
    if (!node || !scene) return [];
    return scene.edges
      .filter((edge) => edge.from === node.id || edge.to === node.id)
      .map((edge) => ({ edge, other: scene.nodes.find((candidate) => candidate.id === (edge.from === node.id ? edge.to : edge.from)) }))
      .filter((relation): relation is { edge: GraphSceneEdge; other: GraphSceneNode } => !!relation.other);
  });

  protected readonly transfers = computed<readonly GraphTransfer[]>(() => {
    const scene = this.scene();
    if (!scene) return [];
    const edge = this.edge();
    if (edge) return scene.transfers.filter((transfer) => edge.transfers.includes(transfer.id));
    const node = this.node();
    if (!node) return [];
    const matches = (transfer: GraphTransfer) =>
      node.root ||
      transfer.to === node.id ||
      transfer.payeeId === node.id ||
      transfer.deviceId === node.id ||
      (node.kind === 'INSTITUTION' && (transfer.destInstitutionId === node.institutionId || scene.nodes.find((candidate) => candidate.root)?.institutionId === node.institutionId));
    return [...scene.transfers].filter(matches).reverse();
  });

  protected labelOf(id: string): string {
    return this.scene()?.nodes.find((node) => node.id === id)?.label ?? id;
  }
}
