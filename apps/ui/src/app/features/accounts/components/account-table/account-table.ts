import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { InstitutionLabelPipe } from '../../../../shared/pipes/institution-label/institution-label-pipe';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import { AccountsFacade, type AccountRow, type SortKey } from '../../data-access/accounts-facade';

interface Column {
  readonly key: SortKey;
  readonly label: string;
  readonly numeric?: boolean;
}

/**
 * The account directory: sortable columns, paging and CSV export over the facade's filtered list. Rows are
 * selectable by click, Enter or Space, and the arrow keys move the selection; the row action opens the account
 * in Investigations directly.
 */
@Component({
  selector: 'sentinel-account-table',
  imports: [DatePipe, Icon, InstitutionLabelPipe, MinorUnitsCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
      <header class="table-head">
        <h2 id="accounts-title">Accounts <span>({{ facade.filtered().length }})</span></h2>
        @if (facade.isFiltered()) {
          <button type="button" class="tool" (click)="facade.clearFilters()"><sentinel-icon name="close" [size]="16" /> Clear filters</button>
        }
        <button type="button" class="tool" [disabled]="facade.filtered().length === 0" (click)="export()"><sentinel-icon name="arrowDownRight" [size]="16" /> Export CSV</button>
      </header>
      <div class="scroller sentinel-scroll">
        <table>
          <thead>
            <tr>
              @for (column of columns; track column.key) {
                <th scope="col" [class.numeric]="column.numeric" [attr.aria-sort]="ariaSort(column.key)">
                  <button type="button" (click)="facade.sortBy(column.key)">
                    {{ column.label }}
                    <span class="arrow" aria-hidden="true">{{ ariaSort(column.key) === 'ascending' ? '▲' : ariaSort(column.key) === 'descending' ? '▼' : '↕' }}</span>
                  </button>
                </th>
              }
              <th scope="col"><span class="sentinel-visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (row of facade.visible(); track row.accountId) {
              <tr
                tabindex="0"
                [attr.data-id]="row.accountId"
                [attr.aria-selected]="facade.selectedId() === row.accountId"
                (click)="choose(row)"
                (keydown)="onKey($event, row)"
              >
                <td>
                  <span class="account">
                    <span class="avatar" aria-hidden="true" [attr.data-band]="row.band">{{ row.reference.slice(-2) }}</span>
                    <b class="sentinel-mono">{{ row.reference }}</b>
                    @if (row.reference !== row.accountId) {
                      <span class="token sentinel-mono">{{ row.accountId }}</span>
                    }
                  </span>
                </td>
                <td><span class="bank"><sentinel-icon name="bank" [size]="15" />{{ row.institutionId | institutionLabel }}</span></td>
                <td class="numeric sentinel-mono">{{ row.windowBalance | minorUnitsCurrency }}</td>
                <td class="numeric sentinel-mono">{{ row.outflow24h | minorUnitsCurrency }}</td>
                <td class="numeric"><span class="risk" [attr.data-band]="row.band"><span class="meter"><span [style.width.%]="row.score"></span></span>{{ row.score }}</span></td>
                <td><span class="pill" [attr.data-decision]="row.decision">{{ row.decision }}</span></td>
                <td><span class="pill" [attr.data-status]="row.status">{{ row.status }}</span></td>
                <td class="sentinel-mono when">{{ row.lastActivity | date: 'd MMM y' : 'UTC' }}<br />{{ row.lastActivity | date: 'HH:mm:ss' : 'UTC' }}</td>
                <td>
                  <button type="button" class="row-action" [attr.aria-label]="'Open ' + row.reference + ' in investigation'" title="Open in investigation" (click)="$event.stopPropagation(); facade.openInvestigation(row)">
                    <sentinel-icon name="investigate" [size]="16" />
                  </button>
                </td>
              </tr>
            } @empty {
              <tr class="empty-row">
                <td colspan="9">
                  {{ facade.accounts().length === 0 ? 'No accounts scored yet. The directory fills as the live stream delivers decisions.' : 'No accounts match the search and filters.' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <footer class="pager">
        <span>Showing {{ range() }} of {{ facade.filtered().length }} accounts</span>
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
  styleUrl: './account-table.css',
})
export class AccountTable {
  protected readonly facade = inject(AccountsFacade);
  protected readonly pageSizes = [8, 12, 20];
  protected readonly columns: readonly Column[] = [
    { key: 'reference', label: 'Account' },
    { key: 'institutionId', label: 'Institution' },
    { key: 'windowBalance', label: 'Window balance', numeric: true },
    { key: 'outflow24h', label: '24h outflow', numeric: true },
    { key: 'score', label: 'Risk score', numeric: true },
    { key: 'decision', label: 'Latest decision' },
    { key: 'status', label: 'Status' },
    { key: 'lastActivity', label: 'Last activity' },
  ];

  /** Page numbers with gaps, for example 1 2 3 … 9. */
  protected readonly pages = computed(() => {
    const count = this.facade.pageCount();
    const current = Math.min(this.facade.page(), count);
    const wanted = new Set([1, count, current - 1, current, current + 1].filter((page) => page >= 1 && page <= count));
    const sorted = [...wanted].sort((a, b) => a - b);
    return sorted.flatMap((page, index) => (index > 0 && page - (sorted[index - 1] ?? page) > 1 ? ['…', page] : [page]));
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

  protected choose(row: AccountRow): void {
    this.facade.select(this.facade.selectedId() === row.accountId ? null : row.accountId);
  }

  protected goTo(page: number | string): void {
    if (typeof page === 'number') this.facade.page.set(page);
  }

  /** Keyboard: Enter or Space toggles the row, up and down move the selection through the visible rows. */
  protected onKey(event: KeyboardEvent, row: AccountRow): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.choose(row);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const rows = this.facade.visible();
    const index = rows.findIndex((candidate) => candidate.accountId === row.accountId);
    const next = rows[index + (event.key === 'ArrowDown' ? 1 : -1)];
    if (!next) return;
    this.facade.select(next.accountId);
    (event.target as HTMLElement).parentElement?.querySelector<HTMLElement>(`tr[data-id="${CSS.escape(next.accountId)}"]`)?.focus();
  }

  protected export(): void {
    const blob = new Blob([this.facade.exportCsv()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sentinel-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
