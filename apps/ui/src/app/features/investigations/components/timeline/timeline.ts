import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import type { TimelineEntry } from '../../models/investigation-view';

/** Transfers, interventions, device and payee events from the bundle, newest first. */
@Component({
  selector: 'sentinel-timeline',
  imports: [DatePipe, MinorUnitsCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="timeline-title">
      <h2 id="timeline-title">Timeline</h2>
      @if (entries().length === 0) {
        <p class="empty">No events in the bundle.</p>
      } @else {
        <ol>
          @for (entry of entries(); track $index) {
            <li [attr.data-kind]="entry.kind">
              <span class="at sentinel-mono">{{ entry.at | date: 'HH:mm:ss' : 'UTC' }}</span>
              <span class="what">
                <span class="title">{{ entry.title }}@if (entry.amount !== null) { · {{ entry.amount | minorUnitsCurrency }}}</span>
                <span class="detail sentinel-mono">{{ entry.detail }}</span>
              </span>
            </li>
          }
        </ol>
      }
    </section>
  `,
  styles: `
    .card {
      padding: var(--sentinel-space-4);
      border: 1px solid var(--sentinel-color-border);
      border-radius: var(--sentinel-radius-medium);
      background: var(--sentinel-color-surface);
    }
    h2 {
      margin: 0 0 var(--sentinel-space-3);
      font-size: var(--sentinel-font-size-body);
    }
    ol {
      list-style: none;
      display: grid;
      gap: var(--sentinel-space-2);
      margin: 0;
      padding: 0;
    }
    li {
      display: grid;
      grid-template-columns: 64px minmax(0, 1fr);
      gap: var(--sentinel-space-2);
      padding-left: var(--sentinel-space-2);
      border-left: 2px solid var(--sentinel-color-border);
      font-size: var(--sentinel-font-size-caption);
    }
    li[data-kind='INTERVENTION'] {
      border-left-color: var(--sentinel-color-warning);
    }
    li[data-kind='DEVICE'],
    li[data-kind='PAYEE'] {
      border-left-color: var(--sentinel-color-series);
    }
    .at,
    .detail,
    .empty {
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-micro);
    }
    .what {
      display: grid;
      min-width: 0;
    }
    .title::first-letter {
      text-transform: uppercase;
    }
    .detail {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class Timeline {
  readonly entries = input.required<readonly TimelineEntry[]>();
}
