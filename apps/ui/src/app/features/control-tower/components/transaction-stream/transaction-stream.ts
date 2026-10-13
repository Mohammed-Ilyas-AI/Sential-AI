import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import type { StreamRow } from '../../models/operations-overview';

/** The five latest decisions at a glance. The full tape, with its tools, lives in Live Transactions. */
@Component({
  selector: 'sentinel-transaction-stream',
  imports: [DatePipe, Icon, MinorUnitsCurrencyPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <h2><sentinel-icon name="chevronRightSmall" [size]="16" />Live Transaction Stream</h2>
      <a class="sentinel-link-button" routerLink="/live-transactions">View All <sentinel-icon name="arrowRight" [size]="14" /></a>
    </header>
    <table>
      <thead>
        <tr>
          <th scope="col">Time</th>
          <th scope="col" class="numeric">Amount</th>
          <th scope="col" class="route-column">From → To</th>
          <th scope="col" class="numeric">Risk</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track row.transactionId) {
          <tr [attr.data-status]="row.status" [attr.data-band]="row.band">
            <td class="sentinel-mono"><span class="marker" aria-hidden="true"></span>{{ row.at | date: 'HH:mm:ss' : 'UTC' }}</td>
            <td class="sentinel-mono numeric amount">{{ row.amount | minorUnitsCurrency }}</td>
            <td class="route route-column">{{ row.from }} → {{ row.to }}</td>
            <td class="sentinel-mono numeric risk">{{ row.score }}</td>
            <td><span class="status"><span class="status-dot" aria-hidden="true"></span>{{ row.status }}</span></td>
          </tr>
        } @empty {
          <tr><td colspan="5" class="empty">Waiting for the first scored transaction…</td></tr>
        }
      </tbody>
    </table>
  `,
  styleUrl: './transaction-stream.css',
})
export class TransactionStream {
  readonly rows = input.required<readonly StreamRow[]>();
}
