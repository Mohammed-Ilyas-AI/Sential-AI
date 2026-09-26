import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AccountRiskPanel, AlertQueue } from '../../../fraud-alerts';
import { TransactionTape } from '../../../live-transactions';
import { AccountTimeline } from '../../components/account-timeline/account-timeline';
import { CustomerNotification } from '../../components/customer-notification/customer-notification';
import { LiveMetrics } from '../../components/live-metrics/live-metrics';
import { PolicyHold } from '../../components/policy-hold/policy-hold';
import { SystemHealth } from '../../components/system-health/system-health';
import { ControlTowerFacade } from '../../data-access/control-tower-facade';

/** The Live Operations Command Center (M§5.1): tape left, counters top, alert queue and right rail. Composes only. */
@Component({
  selector: 'sentinel-control-tower-page',
  imports: [
    LiveMetrics,
    SystemHealth,
    TransactionTape,
    AlertQueue,
    AccountRiskPanel,
    PolicyHold,
    AccountTimeline,
    CustomerNotification,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sentinel-system-health [status]="facade.streamStatus()" />
    <sentinel-live-metrics [metrics]="facade.metrics()" />
    <div class="workspace">
      <sentinel-transaction-tape />
      <div class="column">
        <sentinel-alert-queue />
        <sentinel-account-risk-panel />
        <sentinel-account-timeline [events]="facade.timeline()" />
      </div>
      <div class="column">
        @if (facade.latestHoldNotice(); as notice) {
          <sentinel-customer-notification [notice]="notice" />
        }
        <sentinel-policy-hold [decision]="facade.focusedDecision()" [intervention]="facade.focusedIntervention()" />
      </div>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--sentinel-space-4);
    }
    .workspace {
      display: grid;
      grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr);
      gap: var(--sentinel-space-4);
      align-items: start;
    }
    .column {
      display: grid;
      gap: var(--sentinel-space-3);
    }
    @media (max-width: 1100px) {
      .workspace {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class ControlTowerPage {
  protected readonly facade = inject(ControlTowerFacade);
}
