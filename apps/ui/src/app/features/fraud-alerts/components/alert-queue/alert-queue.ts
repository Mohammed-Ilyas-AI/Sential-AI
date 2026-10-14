import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RiskBandBadge } from '../../../../shared/ui/risk-band-badge/risk-band-badge';
import { FraudAlertsFacade } from '../../data-access/fraud-alerts-facade';

/** One open alert per account, highest risk first; selecting one focuses the right rail on that account. */
@Component({
  selector: 'sentinel-alert-queue',
  imports: [DatePipe, RiskBandBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="alerts-title">
      <header>
        <h2 id="alerts-title">Active alerts</h2>
        <span class="aside sentinel-figures">{{ facade.queue().length }} open</span>
      </header>
      @if (facade.queue().length === 0) {
        <p class="empty">No open alerts.</p>
      } @else {
        <ul>
          @for (alert of facade.queue(); track alert.id) {
            <li>
              <button
                type="button"
                [class.focused]="alert.accountId === facade.focusedAccountId()"
                [attr.aria-pressed]="alert.accountId === facade.focusedAccountId()"
                (click)="facade.select(alert.accountId)"
              >
                <span class="account">{{ alert.accountReference ?? alert.accountId }}</span>
                <span class="score sentinel-figures">{{ alert.score }}</span>
                <sentinel-risk-band-badge [band]="alert.band" />
                @if (alert.onHold) {
                  <span class="hold">HOLD</span>
                }
                <span class="when">updated {{ alert.updatedAt | date: 'HH:mm:ss' : 'UTC' }} UTC</span>
              </button>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    .card {
      background: var(--sentinel-color-surface);
      border: 1px solid var(--sentinel-color-border);
      border-radius: var(--sentinel-radius-medium);
      padding: var(--sentinel-space-4);
      box-shadow: var(--sentinel-elevation-panel);
    }
    header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: var(--sentinel-space-3);
    }
    h2 {
      margin: 0;
      font-size: var(--sentinel-font-size-body);
    }
    .aside,
    .empty,
    .when {
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-caption);
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: var(--sentinel-space-2);
    }
    button {
      width: 100%;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sentinel-space-2);
      padding: var(--sentinel-space-2) var(--sentinel-space-3);
      border: 1px solid var(--sentinel-color-border-interactive);
      border-radius: var(--sentinel-radius-small);
      background: var(--sentinel-color-background);
      color: var(--sentinel-color-text);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    button.focused {
      border-color: var(--sentinel-color-accent);
    }
    .account {
      font-family: var(--sentinel-font-family-mono);
      flex: 1;
    }
    .score {
      font-family: var(--sentinel-font-family-mono);
      font-weight: 600;
    }
    .hold {
      color: var(--sentinel-color-hold);
      font-weight: 700;
      font-size: var(--sentinel-font-size-caption);
    }
    .when {
      width: 100%;
    }
  `,
})
export class AlertQueue {
  protected readonly facade = inject(FraudAlertsFacade);
}
