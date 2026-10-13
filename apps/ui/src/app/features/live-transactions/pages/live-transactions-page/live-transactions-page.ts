import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { TransactionTape } from '../../components/transaction-tape/transaction-tape';

/** The full scored tape: every decision as the gate made it, newest first. */
@Component({
  selector: 'sentinel-live-transactions-page',
  imports: [PageHeader, TransactionTape],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sentinel-page-header
      heading="Live transactions"
      summary="Every transfer scored and gated as it happens. Select an account to focus the control tower on it."
    />
    <sentinel-transaction-tape />
  `,
})
export class LiveTransactionsPage {}
