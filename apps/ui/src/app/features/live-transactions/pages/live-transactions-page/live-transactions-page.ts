import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { TransactionDetail } from '../../components/transaction-detail/transaction-detail';
import { TransactionTape } from '../../components/transaction-tape/transaction-tape';
import { TransactionStreamFacade } from '../../data-access/transaction-stream-facade';

/** The full scored tape: every decision as the gate made it, newest first, with one transaction in detail. */
@Component({
  selector: 'sentinel-live-transactions-page',
  imports: [PageHeader, TransactionTape, TransactionDetail],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <sentinel-page-header
        heading="Live Transactions"
        summary="Every transfer scored and gated as it happens. Select a transaction for its decision, or an account to focus the control tower on it."
      />
      <span class="stream">
        <span class="dot" aria-hidden="true"></span>
        <span class="stack"><b>Real-time stream</b><span>Scored by the deterministic rules engine</span></span>
      </span>
    </div>
    <div class="layout" [class.with-detail]="selectedRow() !== null">
      <sentinel-transaction-tape [(selected)]="selected" [presetQuery]="presetQuery()" />
      @if (selectedRow(); as row) {
        <sentinel-transaction-detail
          [row]="row"
          [status]="facade.interventionStates()[row.transactionId]"
          (closed)="close()"
          (investigate)="facade.openInvestigation($event)"
        />
      }
    </div>
  `,
  styleUrl: './live-transactions-page.css',
})
export class LiveTransactionsPage {
  protected readonly facade = inject(TransactionStreamFacade);
  protected readonly selected = signal<string | null>(null);
  private dismissed = false;
  /** Deep links from the Control Tower globe: ?txn= opens that transaction, ?bank= narrows the table to a bank. */
  private readonly query = toSignal(inject(ActivatedRoute).queryParamMap);
  protected readonly presetQuery = computed(() => this.query()?.get('bank') ?? '');

  /** The selected transaction while it is still on the tape (at most 200 rows are held). */
  protected readonly selectedRow = computed(() => {
    const id = this.selected();
    return id ? (this.facade.tapeRows().find((row) => row.transactionId === id) ?? null) : null;
  });

  constructor() {
    // A linked transaction wins over the default: it is opened as soon as it is on the tape.
    effect(() => {
      const linked = this.query()?.get('txn');
      if (!linked || !this.facade.tapeRows().some((row) => row.transactionId === linked)) return;
      untracked(() => {
        if (this.selected() !== linked) this.selected.set(linked);
        this.dismissed = true;
      });
    });
    // Open on the newest held transfer, the one an analyst looks at first, until they close the panel.
    effect(() => {
      const held = this.facade.tapeRows().find((row) => row.decision !== 'ALLOW');
      untracked(() => {
        if (held && !this.dismissed && this.selected() === null) this.selected.set(held.transactionId);
      });
    });
  }

  protected close(): void {
    this.dismissed = true;
    this.selected.set(null);
  }
}
