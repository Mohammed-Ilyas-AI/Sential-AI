import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import type { GraphSceneEdge, GraphSceneNode } from '../../models/graph-scene';

export interface MoneyTrailStep {
  readonly edge: GraphSceneEdge;
  readonly from: GraphSceneNode | undefined;
  readonly to: GraphSceneNode | undefined;
}

/** Transfers in the neighbourhood, largest first: where the money went and whether the receiver is flagged. */
@Component({
  selector: 'sentinel-trace-funds',
  imports: [MinorUnitsCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (steps().length === 0) {
      <p class="sentinel-empty">No transfer links in this neighbourhood.</p>
    } @else {
      <ol>
        @for (step of steps(); track step.edge.id) {
          <li>
            <button type="button" class="sentinel-link-button mono" (click)="selected.emit(step.edge.to)">{{ step.edge.from }} → {{ step.edge.to }}</button>
            <span class="mono amount">{{ step.edge.weight | minorUnitsCurrency }}</span>
            @if (step.to?.flagged) {
              <span class="sentinel-chip" data-tone="critical">receiver flagged</span>
            }
            <span class="sentinel-muted">{{ step.edge.evidence.sourceInstitution }} · {{ step.edge.evidence.linkage.toLowerCase().replaceAll('_', ' ') }}</span>
          </li>
        }
      </ol>
    }
  `,
  styles: `
    ol { display: grid; gap: var(--sentinel-space-2); margin: 0; padding-left: var(--sentinel-space-4); font-size: var(--sentinel-font-size-caption); }
    li { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sentinel-space-2); }
    .mono { font-family: var(--sentinel-font-family-mono); overflow-wrap: anywhere; }
    .amount { margin-left: auto; }
  `,
})
export class TraceFunds {
  readonly steps = input<readonly MoneyTrailStep[]>([]);
  readonly selected = output<string>();
}
