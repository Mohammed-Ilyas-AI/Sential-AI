import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { AccountRiskPanel } from '../../components/account-risk-panel/account-risk-panel';
import { AccountTimeline } from '../../components/account-timeline/account-timeline';
import { AlertQueue } from '../../components/alert-queue/alert-queue';
import { CustomerNotification } from '../../components/customer-notification/customer-notification';
import { PolicyHold } from '../../components/policy-hold/policy-hold';
import { FraudAlertsFacade } from '../../data-access/fraud-alerts-facade';

/** The analyst's working view of one account: queue, rapid-drain state, the gate's decision trace, timeline. */
@Component({
  selector: 'sentinel-alerts-page',
  imports: [PageHeader, AlertQueue, AccountRiskPanel, PolicyHold, AccountTimeline, CustomerNotification],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sentinel-page-header
      heading="Alerts & Cases"
      summary="Open alerts ranked by advisory score, and the account in focus exactly as the policy gate decided it."
    />
    <div class="layout">
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
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
      gap: var(--sentinel-space-4);
      align-items: start;
    }
    .column {
      display: grid;
      gap: var(--sentinel-space-4);
      min-width: 0;
    }
    @media (max-width: 1023px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class AlertsPage {
  protected readonly facade = inject(FraudAlertsFacade);
}
