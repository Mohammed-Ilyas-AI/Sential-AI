import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NotificationList } from '../../../../layout/notification-panel/notification-list';
import { ShellState } from '../../../../layout/shell/shell-state';
import { Icon } from '../../../../shared/ui/icon/icon';
import { KpiCard } from '../../components/kpi-card/kpi-card';
import { LiveGlobalNetwork } from '../../components/live-global-network/live-global-network';
import { PolicyGate } from '../../components/policy-gate/policy-gate';
import { RiskAnalysis } from '../../components/risk-analysis/risk-analysis';
import { SystemStatus } from '../../components/system-status/system-status';
import { ThreatLandscape } from '../../components/threat-landscape/threat-landscape';
import { TransactionStream } from '../../components/transaction-stream/transaction-stream';
import { ControlTowerFacade } from '../../data-access/control-tower-facade';

/**
 * The Operations Control Tower: global situational awareness on one desktop viewport. Observation only — no
 * search, no filters, no operator workflow; those live in Live Transactions, Alerts & Cases and Investigations.
 */
@Component({
  selector: 'sentinel-control-tower-page',
  imports: [Icon, KpiCard, LiveGlobalNetwork, TransactionStream, RiskAnalysis, SystemStatus, NotificationList, ThreatLandscape, PolicyGate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './control-tower-page.html',
  styleUrl: './control-tower-page.css',
})
export class ControlTowerPage {
  protected readonly facade = inject(ControlTowerFacade);
  protected readonly shell = inject(ShellState);

  protected readonly globeDescription = computed(() => {
    const callouts = this.facade.globeCallouts();
    const held = callouts.find((callout) => callout.tone === 'held');
    const routes = this.facade.networkStats().activeRoutes;
    return held
      ? `Live global network: ${routes} active routes; a transfer into ${held.institution} is on policy hold.`
      : `Live global network: ${routes} active routes, no holds.`;
  });
}
