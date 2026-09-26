import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { StreamConnectionStatus } from '../../../../state/session/session.feature';

/** Stream connection state; an AI outage never looks like a control outage, and neither does a reconnect. */
@Component({
  selector: 'sentinel-system-health',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-label="System health" aria-live="polite">
      <span class="dot" [attr.data-status]="status()"></span>
      Stream {{ label[status()] }}
      <span class="note">Decisions are made by the policy gate on the server, not in this view.</span>
    </section>
  `,
  styles: `
    section {
      display: flex;
      align-items: center;
      gap: var(--sentinel-space-2);
      font-size: var(--sentinel-font-size-caption);
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--sentinel-color-risk-elevated);
    }
    .dot[data-status='LIVE'] {
      background: var(--sentinel-color-risk-low);
    }
    .note {
      color: var(--sentinel-color-text-muted);
      margin-left: auto;
    }
  `,
})
export class SystemHealth {
  readonly status = input<StreamConnectionStatus>('CONNECTING');
  protected readonly label: Readonly<Record<StreamConnectionStatus, string>> = {
    CONNECTING: 'connecting…',
    LIVE: 'live',
    RECONNECTING: 'reconnecting…',
  };
}
