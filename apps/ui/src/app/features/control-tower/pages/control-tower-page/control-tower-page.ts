import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { KpiCard } from '../../components/kpi-card/kpi-card';
import { LiveGlobalNetwork } from '../../components/live-global-network/live-global-network';
import { NeedsAttention } from '../../components/needs-attention/needs-attention';
import { SystemStatus } from '../../components/system-status/system-status';
import { TransactionStream } from '../../components/transaction-stream/transaction-stream';
import { ControlTowerFacade } from '../../data-access/control-tower-facade';

/**
 * The Operations Control Tower on one desktop viewport: headline figures, the live Singapore network, and three
 * compact panels (alerts needing attention, latest transactions, system status). Observation only — the full
 * queues, tape and policy detail live on their own pages, reached through each panel's View All.
 */
@Component({
  selector: 'sentinel-control-tower-page',
  imports: [KpiCard, LiveGlobalNetwork, NeedsAttention, TransactionStream, SystemStatus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './control-tower-page.html',
  styleUrl: './control-tower-page.css',
})
export class ControlTowerPage {
  protected readonly facade = inject(ControlTowerFacade);

  protected readonly globeDescription = computed(() => {
    const callouts = this.facade.globeCallouts();
    const held = callouts.find((callout) => callout.tone === 'held');
    const routes = this.facade.networkStats().activeRoutes;
    return held
      ? `Live Singapore network: ${routes} active routes; a transfer into ${held.institution} is on policy hold.`
      : `Live Singapore network: ${routes} active routes, no holds.`;
  });
}
