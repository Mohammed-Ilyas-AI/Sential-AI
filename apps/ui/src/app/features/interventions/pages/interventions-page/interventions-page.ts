import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { InstitutionLabelPipe } from '../../../../shared/pipes/institution-label/institution-label-pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import { InterventionDetail } from '../../components/intervention-detail/intervention-detail';
import { InterventionTable } from '../../components/intervention-table/intervention-table';
import { InterventionsFacade, type InterventionFilters } from '../../data-access/interventions-facade';

/**
 * Interventions (M§5.3): every policy hold sentinel-core has recorded and what has happened to it since, with the
 * selected hold's transaction and append-only audit trail beside it. Holds are placed by the deterministic gate;
 * this page records only the exceptions sentinel-core accepts and never releases on judgement.
 */
@Component({
  selector: 'sentinel-interventions-page',
  imports: [Icon, InstitutionLabelPipe, InterventionDetail, InterventionTable],
  providers: [InterventionsFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './interventions-page.html',
  styleUrl: './interventions-page.css',
})
export class InterventionsPage {
  protected readonly facade = inject(InterventionsFacade);

  protected setFilter(key: keyof InterventionFilters, value: string): void {
    this.facade.setFilter(key, value as never);
  }
}
