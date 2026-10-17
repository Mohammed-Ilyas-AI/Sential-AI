import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import type { AccountEvent } from '../../../../state/account-focus/account-focus.selectors';

@Component({
  selector: 'sentinel-case-timeline',
  imports: [DatePipe, MinorUnitsCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol>
      @for (event of events().slice(0, 14); track $index) {
        <li [class.intervention]="event.kind === 'INTERVENTION'">
          <span class="mono time">{{ event.at | date: 'HH:mm:ss' : 'UTC' }}</span>
          @if (event.kind === 'DECISION') {
            <span>{{ event.row.decision }} {{ event.row.amount | minorUnitsCurrency }} · score {{ event.row.score }}</span>
          } @else {
            <span>{{ event.intervention.previousState }} → {{ event.intervention.state }} by {{ event.intervention.actor.toLowerCase() }}</span>
          }
        </li>
      } @empty {
        <li class="sentinel-muted">No recorded event.</li>
      }
    </ol>
  `,
  styles: `
    ol { display: grid; gap: var(--sentinel-space-1); margin: 0; padding: 0; list-style: none; font-size: var(--sentinel-font-size-caption); }
    li { display: flex; gap: var(--sentinel-space-3); }
    .intervention { color: var(--sentinel-color-critical-text); }
    .mono { font-family: var(--sentinel-font-family-mono); }
    .time { color: var(--sentinel-color-text-secondary); }
  `,
})
export class CaseTimeline {
  readonly events = input<readonly AccountEvent[]>([]);
}
