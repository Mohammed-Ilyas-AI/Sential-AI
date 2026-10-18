import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import type { IconName } from '../../../../shared/ui/icon/icon-paths';
import type { TimelineEntry } from '../../models/investigation-view';

/**
 * Transfers, policy interventions, device and payee events from the bundle, newest first. A transfer still on the
 * live tape shows the gate's own score and decision; nothing is inferred for one that is not.
 */
@Component({
  selector: 'sentinel-timeline',
  imports: [DatePipe, MinorUnitsCurrencyPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="timeline-title">
      <header>
        <h2 id="timeline-title">Investigation timeline</h2>
        <span class="zone">Times in SGT</span>
      </header>
      @if (entries().length === 0) {
        <p class="empty">No events in the bundle.</p>
      } @else {
        <ol class="sentinel-scroll">
          @for (entry of entries(); track $index) {
            <li [attr.data-kind]="entry.kind" [attr.data-state]="entry.state">
              <span class="node" aria-hidden="true"><sentinel-icon [name]="iconOf(entry)" [size]="14" /></span>
              <span class="at sentinel-mono">{{ entry.at | date: 'HH:mm:ss' : '+0800' }}</span>
              <span class="what">
                <span class="title">{{ entry.title }}@if (entry.amount !== null) { · {{ entry.amount | minorUnitsCurrency }}}</span>
                <span class="detail sentinel-mono">{{ entry.detail }}</span>
              </span>
              @if (entry.decided; as decided) {
                <span class="verdict" [attr.data-band]="decided.band" [attr.data-decision]="decided.decision">
                  <b class="sentinel-figures">{{ decided.score }}</b> {{ decided.decision }}
                </span>
              }
            </li>
          }
        </ol>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      min-height: 0;
    }
    .card {
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      height: 100%;
      padding: var(--sentinel-space-3) var(--sentinel-space-4);
      border: 1px solid var(--sentinel-surface-panel-border);
      border-radius: var(--sentinel-radius-large);
      background: var(--sentinel-surface-card);
      box-shadow: var(--sentinel-elevation-panel);
    }
    header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: var(--sentinel-space-2);
    }
    h2 {
      margin: 0;
      font-size: var(--sentinel-font-size-title);
      font-weight: 600;
    }
    .zone,
    .empty {
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-micro);
    }
    ol {
      list-style: none;
      display: grid;
      margin: 0;
      padding: 0;
      flex: 1;
      min-height: 0;
      overflow: auto;
    }
    li {
      --tone: var(--sentinel-color-text-muted);
      position: relative;
      display: grid;
      grid-template-columns: 26px 64px minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--sentinel-space-3);
      padding: 6px 0;
      font-size: var(--sentinel-font-size-caption);
    }
    /* The rail joining the nodes. */
    li::before {
      content: '';
      position: absolute;
      left: 12px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--sentinel-color-border-soft);
      z-index: 0;
    }
    li:first-child::before { top: 50%; }
    li:last-child::before { bottom: 50%; }
    li[data-kind='TRANSFER'] { --tone: var(--sentinel-color-info); }
    li[data-kind='DEVICE'],
    li[data-kind='PAYEE'] { --tone: var(--sentinel-color-accent-tertiary, var(--sentinel-color-accent)); }
    li[data-kind='INTERVENTION'] { --tone: var(--sentinel-color-warning); }
    li[data-state='HELD'],
    li[data-state='REJECTED'] { --tone: var(--sentinel-color-hold); }
    li[data-state='RELEASED'] { --tone: var(--sentinel-color-success); }
    .node {
      position: relative;
      z-index: 1;
      display: grid;
      place-items: center;
      width: 26px;
      height: 26px;
      border: 2px solid var(--tone);
      border-radius: 50%;
      background: var(--sentinel-surface-card);
      color: var(--tone);
    }
    .at {
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-micro);
    }
    .what {
      display: grid;
      min-width: 0;
      padding-left: var(--sentinel-space-2);
      border-left: 2px solid color-mix(in srgb, var(--tone) 60%, transparent);
    }
    .title {
      font-weight: 600;
    }
    .title::first-letter {
      text-transform: uppercase;
    }
    li[data-kind='INTERVENTION'] .title {
      color: var(--tone);
    }
    .detail {
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-micro);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .verdict {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 10px;
      border-radius: var(--sentinel-radius-pill);
      background: color-mix(in srgb, var(--band) 12%, transparent);
      color: var(--band);
      font-size: var(--sentinel-font-size-micro);
      font-weight: 700;
      white-space: nowrap;
    }
    .verdict[data-band='LOW'] { --band: var(--sentinel-color-risk-low); }
    .verdict[data-band='ELEVATED'] { --band: var(--sentinel-color-risk-elevated); }
    .verdict[data-band='HIGH'] { --band: var(--sentinel-color-risk-high); }
    .verdict[data-band='CRITICAL'] { --band: var(--sentinel-color-risk-critical); }
  `,
})
export class Timeline {
  readonly entries = input.required<readonly TimelineEntry[]>();

  protected iconOf(entry: TimelineEntry): IconName {
    if (entry.kind === 'TRANSFER') return 'transfer';
    if (entry.kind === 'DEVICE') return 'server';
    if (entry.kind === 'PAYEE') return 'account';
    return entry.state === 'RELEASED' ? 'check' : entry.state === 'HELD' ? 'lock' : 'intervention';
  }
}
