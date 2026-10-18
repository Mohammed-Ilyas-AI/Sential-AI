import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import { InterventionsFacade, type InterventionRow, type SortKey } from '../../data-access/interventions-facade';

interface Column {
  readonly key: SortKey | null;
  readonly label: string;
  readonly numeric?: boolean;
  /** Hidden when the table is narrow; the detail drawer always shows it. */
  readonly wideOnly?: boolean;
}

/**
 * Every intervened transfer: sortable, paged, exportable. Policy decision and current status are separate
 * columns. Rows select by click, Enter or Space; the arrow keys move the selection.
 */
@Component({
  selector: 'sentinel-intervention-table',
  imports: [DatePipe, Icon, MinorUnitsCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="table-head">
      <h2 id="interventions-title">Interventions <span>({{ facade.filtered().length }})</span></h2>
      @if (facade.isFiltered()) {
        <button type="button" class="tool" (click)="facade.clearFilters()"><sentinel-icon name="close" [size]="16" /> Clear filters</button>
      }
      <button type="button" class="tool" [disabled]="facade.filtered().length === 0" (click)="export()"><sentinel-icon name="arrowDownRight" [size]="16" /> Export CSV</button>
    </header>
    <div class="scroller sentinel-scroll">
      <table>
        <thead>
          <tr>
            @for (column of columns; track column.label) {
              <th scope="col" [class.numeric]="column.numeric" [class.wide-only]="column.wideOnly" [attr.aria-sort]="column.key ? ariaSort(column.key) : null">
                @if (column.key; as key) {
                  <button type="button" (click)="facade.sortBy(key)">
                    {{ column.label }}
                    <span class="arrow" aria-hidden="true">{{ ariaSort(key) === 'ascending' ? '▲' : ariaSort(key) === 'descending' ? '▼' : '↕' }}</span>
                  </button>
                } @else {
                  <span class="plain">{{ column.label }}</span>
                }
              </th>
            }
            <th scope="col"><span class="sentinel-visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          @for (row of facade.visible(); track row.transactionId) {
            <tr tabindex="0" [attr.data-id]="row.transactionId" [attr.data-rail]="row.state" [attr.aria-selected]="facade.selectedId() === row.transactionId" (click)="choose(row)" (keydown)="onKey($event, row)">
              <td class="mono when">{{ row.heldAt | date: 'd MMM y' : 'UTC' }}<br />{{ row.heldAt | date: 'HH:mm:ss' : 'UTC' }}</td>
              <td>
                <span class="stack">
                  <b class="mono">{{ row.reference }}</b>
                  <span class="mono sub">{{ row.transactionId }}</span>
                </span>
              </td>
              <td><span class="pill" [attr.data-kind]="row.kind">{{ row.kind === 'CASCADE' ? 'CASCADE' : 'HOLD' }}</span></td>
              <td class="reason wide-only">{{ row.reasonCodes.join(', ') || '—' }}</td>
              <td class="numeric mono">{{ row.decided ? (row.decided.amount | minorUnitsCurrency) : '—' }}</td>
              <td class="numeric">
                @if (row.decided; as decided) {
                  <span class="risk" [attr.data-band]="decided.band">{{ decided.score }}</span>
                } @else {
                  —
                }
              </td>
              <td><span class="pill" [attr.data-decision]="row.decided?.decision">{{ row.decided?.decision ?? 'n/a' }}</span></td>
              <td>
                <span class="flow" [attr.aria-label]="'State history: ' + flow(row).join(' then ')">
                  @for (state of flow(row); track $index; let last = $last) {
                    <span class="step" [attr.data-state]="state" [class.current]="last">{{ state }}</span>
                    @if (!last) {
                      <span class="to" aria-hidden="true">→</span>
                    }
                  }
                </span>
              </td>
              <td class="actor wide-only">{{ actor(row) }}</td>
              <td>
                <button type="button" class="row-action" [attr.aria-label]="'Open ' + row.reference + ' in investigation'" title="Open in investigation" (click)="$event.stopPropagation(); facade.openInvestigation(row)">
                  <sentinel-icon name="investigate" [size]="16" />
                </button>
              </td>
            </tr>
          } @empty {
            <tr class="empty-row">
              <td colspan="10">
                {{ facade.rows().length === 0 ? 'No interventions recorded yet. Holds appear here as soon as the policy gate places one.' : 'No interventions match the search and filters.' }}
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <footer class="pager">
      <span>Showing {{ range() }} of {{ facade.filtered().length }} interventions</span>
      <nav aria-label="Pages">
        <button type="button" aria-label="Previous page" [disabled]="facade.page() <= 1" (click)="facade.page.set(facade.page() - 1)"><sentinel-icon name="chevronRight" [size]="14" class="flip" /></button>
        @for (page of pages(); track $index) {
          @if (page === '…') {
            <span class="gap">…</span>
          } @else {
            <button type="button" [attr.aria-current]="page === facade.page() ? 'page' : null" (click)="goTo(page)">{{ page }}</button>
          }
        }
        <button type="button" aria-label="Next page" [disabled]="facade.page() >= facade.pageCount()" (click)="facade.page.set(facade.page() + 1)"><sentinel-icon name="chevronRight" [size]="14" /></button>
      </nav>
      <label class="size">
        Rows per page
        <select [value]="facade.pageSize()" (change)="facade.setPageSize(+$any($event.target).value)">
          @for (size of pageSizes; track size) {
            <option [value]="size">{{ size }}</option>
          }
        </select>
      </label>
    </footer>
  `,
  styleUrl: './intervention-table.css',
})
export class InterventionTable {
  protected readonly facade = inject(InterventionsFacade);
  protected readonly pageSizes = [10, 20, 50];
  protected readonly columns: readonly Column[] = [
    { key: 'heldAt', label: 'Held at' },
    { key: 'reference', label: 'Account / transaction' },
    { key: 'kind', label: 'Type' },
    { key: null, label: 'Reason', wideOnly: true },
    { key: 'amount', label: 'Amount', numeric: true },
    { key: 'score', label: 'Risk', numeric: true },
    { key: null, label: 'Policy decision' },
    { key: 'state', label: 'Status' },
    { key: 'updatedAt', label: 'Last action', wideOnly: true },
  ];

  protected readonly pages = computed(() => {
    const count = this.facade.pageCount();
    const current = Math.min(this.facade.page(), count);
    const wanted = [...new Set([1, count, current - 1, current, current + 1].filter((page) => page >= 1 && page <= count))].sort((a, b) => a - b);
    return wanted.flatMap((page, index) => (index > 0 && page - (wanted[index - 1] ?? page) > 1 ? ['…', page] : [page]));
  });
  protected readonly range = computed(() => {
    const total = this.facade.filtered().length;
    if (total === 0) return '0';
    const size = this.facade.pageSize();
    const start = (Math.min(this.facade.page(), this.facade.pageCount()) - 1) * size + 1;
    return `${start}–${Math.min(total, start + size - 1)}`;
  });

  protected ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    const sort = this.facade.sort();
    return sort.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none';
  }

  /** The states the transfer has passed through, from the audit records, oldest first. */
  protected flow(row: InterventionRow): readonly string[] {
    return row.history.map((record) => record.state);
  }

  protected actor(row: InterventionRow): string {
    const actor = row.actor === 'SYSTEM' ? 'Rule engine' : row.actor === 'CUSTOMER' ? 'Customer' : 'Analyst';
    return row.actorIdentity ? `${actor} · ${row.actorIdentity}` : actor;
  }

  protected choose(row: InterventionRow): void {
    this.facade.select(this.facade.selectedId() === row.transactionId ? null : row.transactionId);
  }

  protected goTo(page: number | string): void {
    if (typeof page === 'number') this.facade.page.set(page);
  }

  protected onKey(event: KeyboardEvent, row: InterventionRow): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.choose(row);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const rows = this.facade.visible();
    const next = rows[rows.findIndex((candidate) => candidate.transactionId === row.transactionId) + (event.key === 'ArrowDown' ? 1 : -1)];
    if (!next) return;
    this.facade.select(next.transactionId);
    (event.target as HTMLElement).parentElement?.querySelector<HTMLElement>(`tr[data-id="${CSS.escape(next.transactionId)}"]`)?.focus();
  }

  /** CSV of every intervention matching the search and filters, in the current order. */
  protected export(): void {
    const cell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const header = ['Held at (UTC)', 'Account', 'Account token', 'Transaction', 'Type', 'Reason', 'Amount (SGD)', 'Risk score', 'Risk band', 'Policy decision', 'Status', 'Last action (UTC)', 'Last action by', 'Records'];
    const lines = this.facade.filtered().map((row) =>
      [
        row.heldAt,
        row.reference,
        row.accountId,
        row.transactionId,
        row.kind,
        row.reasonCodes.join(' '),
        row.decided ? (row.decided.amount / 100).toFixed(2) : '',
        row.decided?.score ?? '',
        row.decided?.band ?? '',
        row.decided?.decision ?? '',
        row.state,
        row.updatedAt,
        this.actor(row),
        row.history.length,
      ]
        .map(cell)
        .join(','),
    );
    const blob = new Blob([[header.map(cell).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sentinel-interventions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
