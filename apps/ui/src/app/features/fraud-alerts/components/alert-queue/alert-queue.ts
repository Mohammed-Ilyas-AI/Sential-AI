import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Icon } from '../../../../shared/ui/icon/icon';
import { RiskBandBadge } from '../../../../shared/ui/risk-band-badge/risk-band-badge';
import { FraudAlertsFacade } from '../../data-access/fraud-alerts-facade';

/**
 * One open alert per account, highest risk first; selecting one focuses the detail panel on that account.
 * Each demo run creates fresh synthetic accounts that share a display reference, so every entry also shows its
 * own account token and date: several "ACC-10291" rows are distinct alerts, never duplicates.
 */
@Component({
  selector: 'sentinel-alert-queue',
  imports: [DatePipe, Icon, RiskBandBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="alerts-title">
      <header>
        <h2 id="alerts-title">Alert queue</h2>
        <span class="aside sentinel-figures">{{ facade.queue().length }} {{ facade.queue().length === 1 ? 'entry' : 'entries' }}</span>
      </header>
      @if (facade.queue().length === 0) {
        <p class="empty">No open alerts.</p>
      } @else {
        <ul class="sentinel-scroll">
          @for (alert of facade.queue(); track alert.id) {
            <li>
              <button
                type="button"
                [class.focused]="alert.accountId === facade.focusedAccountId()"
                [attr.aria-pressed]="alert.accountId === facade.focusedAccountId()"
                (click)="facade.select(alert.accountId)"
              >
                <span class="radio" aria-hidden="true"></span>
                <span class="who">
                  <span class="account">{{ alert.accountReference ?? alert.accountId }}</span>
                  <span class="meta">{{ alert.accountId }} · updated {{ alert.updatedAt | date: 'd MMM HH:mm:ss' : 'UTC' }} UTC</span>
                </span>
                <span class="risk">
                  <span class="line"><b class="score sentinel-figures">{{ alert.score }}</b><sentinel-risk-band-badge [band]="alert.band" /></span>
                  <span class="policy">Policy: <b [class.hold]="alert.onHold">{{ alert.onHold ? 'HOLD' : 'ALLOW' }}</b></span>
                </span>
                <sentinel-icon class="chevron" name="chevronRight" [size]="18" />
              </button>
            </li>
          }
        </ul>
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
    .aside,
    .empty,
    .meta {
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-caption);
    }
    ul {
      flex: 1;
      min-height: 0;
      overflow: auto;
      list-style: none;
      margin: 0;
      padding: 0 2px 2px 0;
      display: grid;
      align-content: start;
      gap: var(--sentinel-space-2);
    }
    button {
      width: 100%;
      display: flex;
      align-items: center;
      gap: var(--sentinel-space-3);
      padding: 10px var(--sentinel-space-3);
      border: 1px solid var(--sentinel-color-border);
      border-radius: var(--sentinel-radius-medium);
      background: var(--sentinel-surface-card);
      color: var(--sentinel-color-text);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    button:hover {
      border-color: var(--sentinel-color-border-interactive);
    }
    button.focused {
      border-color: var(--sentinel-color-accent);
      background: color-mix(in srgb, var(--sentinel-color-accent) 7%, var(--sentinel-surface-card));
      box-shadow: 0 0 0 1px var(--sentinel-color-accent);
    }
    .radio {
      width: 18px;
      height: 18px;
      flex: none;
      border: 2px solid var(--sentinel-color-border-interactive);
      border-radius: 50%;
    }
    .focused .radio {
      border-color: var(--sentinel-color-accent);
      background: radial-gradient(circle, var(--sentinel-color-accent) 45%, transparent 50%);
    }
    .who {
      display: grid;
      flex: 1;
      min-width: 0;
      gap: 2px;
    }
    .account {
      font-family: var(--sentinel-font-family-mono);
      font-weight: 600;
    }
    .meta {
      overflow: hidden;
      font-size: var(--sentinel-font-size-micro);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .risk {
      display: grid;
      gap: 2px;
      flex: none;
      padding-left: var(--sentinel-space-3);
      border-left: 1px solid var(--sentinel-color-border-soft);
    }
    .line {
      display: flex;
      align-items: center;
      gap: var(--sentinel-space-2);
    }
    .score {
      font-family: var(--sentinel-font-family-mono);
      font-size: var(--sentinel-font-size-body);
    }
    .policy {
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-micro);
    }
    .policy .hold {
      color: var(--sentinel-color-hold);
    }
    .chevron {
      flex: none;
      color: var(--sentinel-color-text-muted);
    }
  `,
})
export class AlertQueue {
  protected readonly facade = inject(FraudAlertsFacade);
}
