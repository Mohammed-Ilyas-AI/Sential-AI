import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { InstitutionLabelPipe } from '../../../../shared/pipes/institution-label/institution-label-pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import { AccountDetail } from '../../components/account-detail/account-detail';
import { AccountTable } from '../../components/account-table/account-table';
import { AccountsFacade, type AccountFilters } from '../../data-access/accounts-facade';

/**
 * Accounts (M§5): every account the live stream has scored, as a searchable, sortable directory with the
 * selected account's details beside it. No account listing API exists, so nothing here is fetched or invented
 * beyond the stream's decision records and the selected account's evidence bundle.
 */
@Component({
  selector: 'sentinel-accounts-page',
  imports: [Icon, InstitutionLabelPipe, AccountDetail, AccountTable],
  providers: [AccountsFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './accounts-page.html',
  styleUrl: './accounts-page.css',
})
export class AccountsPage {
  protected readonly facade = inject(AccountsFacade);

  protected setFilter(key: keyof AccountFilters, value: string): void {
    this.facade.setFilter(key, value as never);
  }
}
