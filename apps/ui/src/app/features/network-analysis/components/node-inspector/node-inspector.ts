import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import type { GraphSceneEdge, GraphSceneNode } from '../../models/graph-scene';

/** The selected entity and every link touching it, each with its provenance and whether it may score. */
@Component({
  selector: 'sentinel-node-inspector',
  imports: [MinorUnitsCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (node(); as node) {
      <dl>
        <div><dt>Entity</dt><dd class="mono">{{ node.id }}</dd></div>
        <div><dt>Kind</dt><dd>{{ node.kind.toLowerCase() }} · hop {{ node.hop }}</dd></div>
        @if (node.institutionId) {
          <div><dt>Institution</dt><dd>{{ node.institutionId }}</dd></div>
        }
        <div><dt>Flagged</dt><dd>{{ node.flagged ? 'Yes' : 'No' }}</dd></div>
        <div><dt>Indicators</dt><dd>{{ node.riskIndicators.length ? node.riskIndicators.join(', ') : '—' }}</dd></div>
        <div><dt>Transactions</dt><dd class="mono">{{ node.txCount }}</dd></div>
      </dl>
      <p class="sentinel-eyebrow">Links ({{ edges().length }})</p>
      <ul>
        @for (edge of edges(); track edge.id) {
          <li>
            <span class="mono">{{ edge.from === node.id ? '→ ' + edge.to : '← ' + edge.from }}</span>
            <span>{{ edge.kind.toLowerCase().replaceAll('_', ' ') }}{{ edge.kind === 'TRANSFERRED_TO' ? ' · ' + (edge.weight | minorUnitsCurrency) : '' }}</span>
            <span class="sentinel-chip" [attr.data-tone]="edge.evidence.scoring === 'CONFIRMED' ? 'critical' : edge.evidence.scoring === 'STRONG' ? 'warning' : null">
              {{ edge.evidence.linkage.toLowerCase().replaceAll('_', ' ') }} · {{ edge.evidence.scoring.toLowerCase() }}
            </span>
          </li>
        }
      </ul>
    } @else {
      <p class="sentinel-empty">Select an entity in the graph to see its links and their provenance.</p>
    }
  `,
  styles: `
    dl { display: grid; gap: var(--sentinel-space-2); margin: 0 0 var(--sentinel-space-3); font-size: var(--sentinel-font-size-caption); }
    dl div { display: grid; grid-template-columns: 100px 1fr; gap: var(--sentinel-space-2); }
    dt { color: var(--sentinel-color-text-secondary); }
    dd { margin: 0; overflow-wrap: anywhere; }
    .mono { font-family: var(--sentinel-font-family-mono); }
    ul { display: grid; gap: var(--sentinel-space-2); margin: var(--sentinel-space-2) 0 0; padding: 0; list-style: none; font-size: var(--sentinel-font-size-caption); }
    li { display: flex; flex-wrap: wrap; gap: var(--sentinel-space-2); align-items: center; }
  `,
})
export class NodeInspector {
  readonly node = input<GraphSceneNode | null>(null);
  readonly edges = input<readonly GraphSceneEdge[]>([]);
}
