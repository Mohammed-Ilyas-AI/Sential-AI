import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import type { AccountEvent } from '../../../../state/account-focus/account-focus.selectors';

/** The focused account's decisions and interventions as they arrived, newest first. */
@Component({
  selector: 'sentinel-account-timeline',
  imports: [DatePipe, MinorUnitsCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="timeline-title">
      <h2 id="timeline-title">Timeline</h2>
      @if (events().length === 0) {
        <p class="empty">No events for the account in focus.</p>
      } @else {
        <ol>
          @for (event of events(); track trackKey(event)) {
            <li [attr.data-kind]="event.kind">
              <time class="when" [attr.datetime]="event.at">{{ event.at | date: 'HH:mm:ss' : 'UTC' }}</time>
              @switch (event.kind) {
                @case ('DECISION') {
                  <span>
                    {{ event.row.decision }} {{ event.row.amount | minorUnitsCurrency }} ·
                    score {{ event.row.score }} {{ event.row.band }}
                  </span>
                }
                @case ('INTERVENTION') {
                  <span class="intervention">
                    {{ event.intervention.previousState }} → {{ event.intervention.state }} ({{ event.intervention.actor }})
                  </span>
                }
              }
            </li>
          }
        </ol>
      }
    </section>
  `,
  styles: `
    .card {
      background: var(--sentinel-color-surface);
      border: 1px solid var(--sentinel-color-border);
      border-radius: var(--sentinel-radius-medium);
      padding: var(--sentinel-space-4);
    }
    h2 {
      margin: 0 0 var(--sentinel-space-3);
      font-size: var(--sentinel-font-size-body);
    }
    ol {
      list-style: none;
      margin: 0;
      padding: 0 0 0 var(--sentinel-space-3);
      border-left: 1px solid var(--sentinel-color-border);
      display: grid;
      gap: var(--sentinel-space-2);
      font-size: var(--sentinel-font-size-caption);
    }
    li {
      display: flex;
      gap: var(--sentinel-space-3);
    }
    .when,
    .empty {
      color: var(--sentinel-color-text-muted);
      font-family: var(--sentinel-font-family-mono);
      font-size: var(--sentinel-font-size-caption);
    }
    .intervention {
      color: var(--sentinel-color-hold);
      font-weight: 600;
    }
  `,
})
export class AccountTimeline {
  readonly events = input<readonly AccountEvent[]>([]);

  protected trackKey(event: AccountEvent): string {
    return event.kind === 'DECISION' ? `d:${event.row.transactionId}` : `i:${event.intervention.id}`;
  }
}
