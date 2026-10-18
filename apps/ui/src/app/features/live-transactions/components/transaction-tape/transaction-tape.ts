import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, signal, untracked } from '@angular/core';
import { TRANSACTION_TAPE_MAX_ROWS, type Decision, type RiskBand } from '@sentinel/domain';
import { InstitutionLabelPipe } from '../../../../shared/pipes/institution-label/institution-label-pipe';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import type { TapeRow } from '../../../../workers/transaction-worker-protocol';
import { TransactionStreamFacade } from '../../data-access/transaction-stream-facade';

/** 25 by default: the table body scrolls inside the page, so a desktop shows as many as fit. */
const PAGE_SIZES = [10, 25, 50] as const;
const DECISIONS: readonly Decision[] = ['ALLOW', 'HOLD', 'REJECT'];
const BANDS: readonly RiskBand[] = ['LOW', 'ELEVATED', 'HIGH', 'CRITICAL'];
/** The control tower clock reads Singapore time; the wire stays UTC ISO 8601. */
const SGT = '+0800';

const institutionLabel = new InstitutionLabelPipe();

/**
 * The live tape (T§6) as a monitoring table: at most 200 rows held, newest first, filtered in the browser and
 * paged so only one page of rows is ever in the DOM. Every value is the gate's own record; a held row is
 * marked in text as well as colour, and the status is the intervention state the server recorded.
 */
@Component({
  selector: 'sentinel-transaction-tape',
  imports: [DatePipe, MinorUnitsCurrencyPipe, InstitutionLabelPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="tape-title">
      <h2 id="tape-title" class="sentinel-visually-hidden">Live transactions</h2>
      <div class="toolbar">
        <label class="search">
          <sentinel-icon name="search" [size]="18" />
          <span class="sentinel-visually-hidden">Search transactions</span>
          <input
            type="search"
            placeholder="Search account, transaction or bank…"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
          />
        </label>
        <label class="filter">
          <span>Account</span>
          <select [value]="account()" (change)="account.set($any($event.target).value)">
            <option value="">All accounts</option>
            @for (option of accounts(); track option.id) {
              <option [value]="option.id">{{ option.label }}</option>
            }
          </select>
        </label>
        <label class="filter">
          <span>Decision</span>
          <select [value]="decision()" (change)="decision.set($any($event.target).value)">
            <option value="">All decisions</option>
            @for (option of decisions; track option) {
              <option [value]="option">{{ option }}</option>
            }
          </select>
        </label>
        <label class="filter">
          <span>Risk band</span>
          <select [value]="band()" (change)="band.set($any($event.target).value)">
            <option value="">All bands</option>
            @for (option of bands; track option) {
              <option [value]="option">{{ option }}</option>
            }
          </select>
        </label>
        <span class="live"><span class="dot" aria-hidden="true"></span>Live</span>
        <span class="aside sentinel-figures" aria-label="Rows shown of rows held">{{ filtered().length }} / {{ maxRows }}</span>
      </div>

      @if (facade.tapeRows().length === 0) {
        <p class="empty">Waiting for the first scored transaction…</p>
      } @else if (filtered().length === 0) {
        <p class="empty">No transaction matches these filters.</p>
      } @else {
        <div class="viewport sentinel-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Time (SGT)</th>
                <th scope="col">Transaction</th>
                <th scope="col">Account</th>
                <th scope="col">Destination</th>
                <th scope="col" class="numeric">Amount</th>
                <th scope="col" class="numeric">Risk score</th>
                <th scope="col">Policy decision</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (row of page(); track row.transactionId) {
                <tr
                  [class.held]="row.decision !== 'ALLOW'"
                  [class.selected]="row.transactionId === selected()"
                  [class.focused]="row.accountId === facade.focusedAccountId()"
                  [attr.data-band]="row.band"
                  [attr.aria-selected]="row.transactionId === selected()"
                  (click)="selected.set(row.transactionId)"
                >
                  <td class="mono muted">{{ row.occurredAt | date: 'HH:mm:ss' : sgt }}</td>
                  <td>
                    <span class="txn">
                      <span class="glyph" [attr.data-decision]="row.decision" aria-hidden="true">
                        <sentinel-icon [name]="row.decision === 'ALLOW' ? 'arrowRight' : 'arrowUpRight'" [size]="16" />
                      </span>
                      <span class="stack">
                        <button type="button" class="link" (click)="select(row, $event)" [attr.aria-label]="'Show details of ' + row.transactionId">
                          {{ row.transactionId }}
                        </button>
                        <span class="sub">{{ row.institutionId | institutionLabel }} → {{ row.destinationInstitutionId | institutionLabel }}</span>
                      </span>
                    </span>
                  </td>
                  <td>
                    <span class="stack">
                      <button type="button" class="account" (click)="focusAccount(row, $event)" [attr.aria-label]="'Focus account ' + (row.accountReference ?? row.accountId)">
                        {{ row.accountReference ?? row.accountId }}
                      </button>
                      <span class="sub">{{ row.institutionId | institutionLabel }}</span>
                    </span>
                  </td>
                  <td>{{ row.destinationInstitutionId | institutionLabel }}</td>
                  <td class="mono numeric">{{ row.amount | minorUnitsCurrency }}</td>
                  <td class="numeric">
                    <span class="score mono" [attr.aria-label]="'Score ' + row.score + ', ' + row.band">{{ row.score }}</span>
                  </td>
                  <td>
                    <span class="decision" [attr.data-decision]="row.decision">{{ row.decision }}</span>
                  </td>
                  <td>
                    @if (facade.interventionStates()[row.transactionId]; as state) {
                      <span class="status" [attr.data-state]="state">{{ statusLabel[state] }}</span>
                    } @else {
                      <span class="muted" aria-label="No intervention">—</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <nav class="pager" aria-label="Transaction pages">
          <div class="pages">
            <button type="button" class="page-button" [disabled]="pageIndex() === 0" (click)="pageIndex.set(pageIndex() - 1)">
              <sentinel-icon name="chevronsLeft" [size]="16" label="Previous page" />
            </button>
            @for (number of pageNumbers(); track number) {
              <button
                type="button"
                class="page-button"
                [class.current]="number === pageIndex()"
                [attr.aria-current]="number === pageIndex() ? 'page' : null"
                (click)="pageIndex.set(number)"
              >
                {{ number + 1 }}
              </button>
            }
            <button type="button" class="page-button" [disabled]="pageIndex() >= pageCount() - 1" (click)="pageIndex.set(pageIndex() + 1)">
              <sentinel-icon name="chevronsRight" [size]="16" label="Next page" />
            </button>
          </div>
          <span class="muted range">Showing {{ range().from }}–{{ range().to }} of {{ filtered().length }}</span>
          <label class="filter size">
            <span>Rows per page</span>
            <select (change)="pageSize.set(+$any($event.target).value)">
              @for (size of pageSizes; track size) {
                <option [value]="size" [selected]="size === pageSize()">{{ size }}</option>
              }
            </select>
          </label>
        </nav>
      }
    </section>
  `,
  styleUrl: './transaction-tape.css',
})
export class TransactionTape {
  protected readonly facade = inject(TransactionStreamFacade);
  protected readonly maxRows = TRANSACTION_TAPE_MAX_ROWS;
  protected readonly sgt = SGT;
  protected readonly decisions = DECISIONS;
  protected readonly bands = BANDS;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly statusLabel: Readonly<Record<string, string>> = { HELD: 'Held', RELEASED: 'Released', REJECTED: 'Rejected', CANCELLED: 'Cancelled' };

  /** The transaction shown in the detail panel; the page owns it. */
  readonly selected = model<string | null>(null);
  /** A search the page opens with (a bank linked from the Control Tower); the analyst can change it. */
  readonly presetQuery = input('');

  protected readonly query = signal('');
  protected readonly account = signal('');
  protected readonly decision = signal('');
  protected readonly band = signal('');
  protected readonly pageSize = signal<number>(PAGE_SIZES[1]);
  protected readonly pageIndex = signal(0);

  protected readonly accounts = computed(() => {
    const seen = new Map<string, string>();
    for (const row of this.facade.tapeRows()) if (!seen.has(row.accountId)) seen.set(row.accountId, row.accountReference ?? row.accountId);
    return [...seen].map(([id, label]) => ({ id, label })).sort((left, right) => left.label.localeCompare(right.label));
  });

  protected readonly filtered = computed(() => {
    const query = this.query().trim().toLowerCase();
    const account = this.account();
    const decision = this.decision();
    const band = this.band();
    return this.facade.tapeRows().filter(
      (row) =>
        (!account || row.accountId === account) &&
        (!decision || row.decision === decision) &&
        (!band || row.band === band) &&
        (!query ||
          [row.transactionId, row.accountId, row.accountReference ?? '', institutionLabel.transform(row.destinationInstitutionId), institutionLabel.transform(row.institutionId)]
            .some((field) => field.toLowerCase().includes(query))),
    );
  });

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize())));
  protected readonly page = computed(() => {
    const start = Math.min(this.pageIndex(), this.pageCount() - 1) * this.pageSize();
    return this.filtered().slice(start, start + this.pageSize());
  });
  protected readonly range = computed(() => {
    const total = this.filtered().length;
    const from = total === 0 ? 0 : Math.min(this.pageIndex(), this.pageCount() - 1) * this.pageSize() + 1;
    return { from, to: Math.min(total, from - 1 + this.pageSize()) };
  });
  /** At most five page buttons, centred on the current page. */
  protected readonly pageNumbers = computed(() => {
    const count = this.pageCount();
    const first = Math.max(0, Math.min(this.pageIndex() - 2, count - 5));
    return Array.from({ length: Math.min(5, count) }, (_, index) => first + index);
  });

  constructor() {
    effect(() => {
      const preset = this.presetQuery();
      if (preset) untracked(() => this.query.set(preset));
    });
    // A new filter or page size starts again from the first page.
    effect(() => {
      this.query();
      this.account();
      this.decision();
      this.band();
      this.pageSize();
      untracked(() => this.pageIndex.set(0));
    });
  }

  protected select(row: TapeRow, event: Event): void {
    event.stopPropagation();
    this.selected.set(row.transactionId);
  }

  /** Focusing an account steers the control tower, as before, and shows this transaction's details. */
  protected focusAccount(row: TapeRow, event: Event): void {
    event.stopPropagation();
    this.facade.focus(row.accountId);
    this.selected.set(row.transactionId);
  }
}
