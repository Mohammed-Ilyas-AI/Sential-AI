import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AccountRiskPanel, AlertQueue } from '../../../fraud-alerts';
import { TransactionTape } from '../../../live-transactions';
import { CustomerNotification } from '../../components/customer-notification/customer-notification';
import { LiveMetrics } from '../../components/live-metrics/live-metrics';
import { PolicyHold } from '../../components/policy-hold/policy-hold';
import { SystemHealth } from '../../components/system-health/system-health';

/** The Live Operations Command Center (M§5.1): tape left, counters top, alert queue and right rail. Composes only. */
@Component({
  selector: 'sentinel-control-tower-page',
  imports: [LiveMetrics, SystemHealth, TransactionTape, AlertQueue, AccountRiskPanel, PolicyHold, CustomerNotification],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sentinel-live-metrics />
    <sentinel-system-health />
    <div class="workspace">
      <sentinel-transaction-tape />
      <sentinel-alert-queue />
      <div class="right-rail">
        <sentinel-account-risk-panel />
        <sentinel-policy-hold />
      </div>
    </div>
    <sentinel-customer-notification />
  `,
  styles: `
    .workspace {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: var(--sentinel-space-4);
    }
  `,
})
export class ControlTowerPage {}
