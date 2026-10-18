import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import type { AttentionItem } from '../../models/operations-overview';

/** The few open alerts that matter most right now. The full queue, with its tools, lives in Alerts & Cases. */
@Component({
  selector: 'sentinel-needs-attention',
  imports: [DatePipe, Icon, MinorUnitsCurrencyPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <h2><sentinel-icon name="chevronRightSmall" [size]="16" />Needs Attention</h2>
      <a class="sentinel-link-button" routerLink="/alerts">View All <sentinel-icon name="arrowRight" [size]="14" /></a>
    </header>
    <ul>
      @for (item of items(); track item.alertId) {
        <li>
          <button type="button" [attr.data-tone]="item.tone" (click)="open.emit(item.accountId)">
            <span class="tile"><sentinel-icon [name]="item.tone === 'elevated' ? 'shieldAlert' : 'alert'" [size]="18" /></span>
            <span class="text">
              <span class="account sentinel-mono">{{ item.account }}</span>
              <span class="context">
                @if (item.route) {
                  {{ item.route }} ·
                }
                @if (item.amount !== null) {
                  {{ item.amount | minorUnitsCurrency }}
                } @else {
                  {{ item.transactionId }}
                }
              </span>
            </span>
            <span class="status">{{ item.status }}</span>
            <span class="time sentinel-mono">{{ item.at | date: 'HH:mm:ss' : 'UTC' }}</span>
          </button>
        </li>
      } @empty {
        <li class="empty">No open alerts.</li>
      }
    </ul>
  `,
  styles: `
    :host {
      container-type: inline-size;
      display: flex;
      flex-direction: column;
      min-height: 0;
      padding: 10px 14px;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    h2 {
      display: flex;
      align-items: center;
      gap: 4px;
      margin: 0;
      font-size: 0.9375rem;
      font-weight: 600;
    }
    ul {
      display: grid;
      gap: 6px;
      min-height: 0;
      margin: 0;
      padding: 0;
      overflow: hidden;
      list-style: none;
    }
    button {
      --tone: var(--sentinel-color-critical);
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto auto;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 6px 10px;
      border: 1px solid var(--sentinel-color-border-soft);
      border-radius: 10px;
      background: color-mix(in srgb, var(--sentinel-color-surface) 70%, transparent);
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    button:hover {
      border-color: color-mix(in srgb, var(--tone) 40%, transparent);
    }
    [data-tone='elevated'] {
      --tone: var(--sentinel-color-warning);
    }
    [data-tone='cleared'] {
      --tone: var(--sentinel-color-success);
    }
    .tile {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: color-mix(in srgb, var(--tone) 14%, transparent);
      color: var(--tone);
    }
    .text {
      display: grid;
      min-width: 0;
    }
    .account {
      font-size: 0.875rem;
      font-weight: 700;
    }
    .context {
      overflow: hidden;
      color: var(--sentinel-color-text-secondary);
      font-size: 0.75rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .status {
      padding: 2px 8px;
      border-radius: 6px;
      background: color-mix(in srgb, var(--tone) 14%, transparent);
      color: var(--tone);
      font-size: 0.6875rem;
      font-weight: 700;
    }
    .time {
      color: var(--sentinel-color-text-secondary);
      font-size: 0.75rem;
    }
    @container (max-width: 340px) {
      button {
        grid-template-columns: auto minmax(0, 1fr) auto;
      }
      .time {
        display: none;
      }
    }
    .empty {
      padding: 12px 4px;
      color: var(--sentinel-color-text-secondary);
      font-size: 0.8125rem;
    }
  `,
})
export class NeedsAttention {
  readonly items = input.required<readonly AttentionItem[]>();
  /** The analyst chose an alert: the page opens its account in Alerts & Cases. */
  readonly open = output<string>();
}
