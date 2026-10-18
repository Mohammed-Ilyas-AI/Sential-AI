import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Icon } from '../../../../shared/ui/icon/icon';
import { KpiTile } from '../../../../shared/ui/kpi-tile/kpi-tile';
import type { IconName } from '../../../../shared/ui/icon/icon-paths';
import { ConnectorDetail } from '../../components/connector-detail/connector-detail';
import { IntegrationsFacade, type ConnectorCategory, type ConnectorStatus } from '../../data-access/integrations-facade';

/**
 * Integrations (M§13): the connectors this deployment actually runs on, each with an honest status and how it is
 * known. Read and probe only; connections are provisioned through deployment configuration.
 */
@Component({
  selector: 'sentinel-integrations-page',
  imports: [DatePipe, Icon, KpiTile, ConnectorDetail],
  providers: [IntegrationsFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './integrations-page.html',
  styleUrl: './integrations-page.css',
})
export class IntegrationsPage {
  protected readonly facade = inject(IntegrationsFacade);
  protected readonly categories: readonly ('ALL' | ConnectorCategory)[] = ['ALL', 'Banking', 'Platform', 'Data', 'AI'];
  protected readonly icon: Readonly<Record<ConnectorCategory, IconName>> = { Banking: 'bank', Platform: 'server', Data: 'grid', AI: 'explain' };
  protected readonly statuses: readonly ConnectorStatus[] = ['HEALTHY', 'INFERRED', 'IDLE', 'DEGRADED', 'UNAVAILABLE', 'UNOBSERVABLE'];
  protected readonly statusLabel: Readonly<Record<ConnectorStatus, string>> = {
    HEALTHY: 'Healthy',
    DEGRADED: 'Degraded',
    UNAVAILABLE: 'Unavailable',
    IDLE: 'Idle',
    INFERRED: 'Healthy (inferred)',
    UNOBSERVABLE: 'Not observable',
  };

  protected choose(id: string): void {
    this.facade.selectedId.set(this.facade.selectedId() === id ? null : id);
  }

  protected onKey(event: KeyboardEvent, id: string): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.choose(id);
  }
}
