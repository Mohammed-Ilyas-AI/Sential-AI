import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import type { IconName } from '../../../../shared/ui/icon/icon-paths';
import type { AccountEvent } from '../../../../state/account-focus/account-focus.selectors';

/** The focused account's decisions and interventions as they arrived, newest first, on a compact rail. */
@Component({
  selector: 'sentinel-account-timeline',
  imports: [DatePipe, MinorUnitsCurrencyPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (events().length === 0) {
      <p class="empty">No events for the account in focus.</p>
    } @else {
      <ol class="sentinel-scroll" aria-label="Account timeline">
        @for (event of events(); track trackKey(event)) {
          <li [attr.data-kind]="event.kind" [attr.data-state]="event.kind === 'INTERVENTION' ? event.intervention.state : event.row.decision">
            <span class="node" aria-hidden="true"><sentinel-icon [name]="iconOf(event)" [size]="14" /></span>
            <time class="when sentinel-mono" [attr.datetime]="event.at">{{ event.at | date: 'HH:mm:ss' : 'UTC' }}</time>
            @switch (event.kind) {
              @case ('DECISION') {
                <span class="what">
                  <b>{{ event.row.decision }} {{ event.row.amount | minorUnitsCurrency }} · score {{ event.row.score }}</b>
                  <span class="sentinel-mono">{{ event.row.transactionId }}</span>
                </span>
              }
              @case ('INTERVENTION') {
                <span class="what intervention">
                  <b>{{ event.intervention.state }} by {{ event.intervention.actor.toLowerCase() }}</b>
                  <span>{{ event.intervention.previousState }} → {{ event.intervention.state }} · {{ event.intervention.reasonCodes.join(', ') }}</span>
                </span>
              }
            }
          </li>
        }
      </ol>
    }
  `,
  styles: `
    :host {
      display: block;
      min-height: 0;
    }
    ol {
      list-style: none;
      display: grid;
      margin: 0;
      padding: 0;
      max-height: 180px;
      overflow: auto;
    }
    li {
      --tone: var(--sentinel-color-info);
      position: relative;
      display: grid;
      grid-template-columns: 24px 58px minmax(0, 1fr);
      align-items: center;
      gap: var(--sentinel-space-2);
      padding: 4px 0;
      font-size: var(--sentinel-font-size-caption);
    }
    li::before {
      content: '';
      position: absolute;
      left: 11px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--sentinel-color-border-soft);
    }
    li:first-child::before { top: 50%; }
    li:last-child::before { bottom: 50%; }
    li[data-state='HOLD'],
    li[data-state='REJECT'],
    li[data-state='HELD'],
    li[data-state='REJECTED'] { --tone: var(--sentinel-color-hold); }
    li[data-state='RELEASED'],
    li[data-state='ALLOW'] { --tone: var(--sentinel-color-success); }
    .node {
      position: relative;
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      border: 2px solid var(--tone);
      border-radius: 50%;
      background: var(--sentinel-surface-card, var(--sentinel-color-surface));
      color: var(--tone);
    }
    .when,
    .empty,
    .what span {
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-micro);
    }
    .what {
      display: grid;
      min-width: 0;
      padding-left: var(--sentinel-space-2);
      border-left: 2px solid color-mix(in srgb, var(--tone) 55%, transparent);
    }
    .what span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .intervention b {
      color: var(--tone);
    }
  `,
})
export class AccountTimeline {
  readonly events = input<readonly AccountEvent[]>([]);

  protected trackKey(event: AccountEvent): string {
    return event.kind === 'DECISION' ? `d:${event.row.transactionId}` : `i:${event.intervention.id}`;
  }

  protected iconOf(event: AccountEvent): IconName {
    if (event.kind === 'DECISION') return 'transfer';
    return event.intervention.state === 'HELD' ? 'lock' : event.intervention.state === 'RELEASED' ? 'check' : 'intervention';
  }
}
