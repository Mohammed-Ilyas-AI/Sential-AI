import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Icon } from '../../../../shared/ui/icon/icon';
import { KpiTile } from '../../../../shared/ui/kpi-tile/kpi-tile';
import { AuditEventDetail } from '../../components/audit-event-detail/audit-event-detail';
import { AUDIT_PAGE_SIZE, AUDIT_ZONE_OFFSET, AuditLogsFacade, type AuditFilters, type AuditSortKey } from '../../data-access/audit-logs-facade';

/**
 * Audit Logs (M§13): every decision, intervention transition and alert this session has received, read-only, with
 * filters, sorting, paging and a CSV export of the filtered trail.
 */
@Component({
  selector: 'sentinel-audit-logs-page',
  imports: [DatePipe, Icon, KpiTile, AuditEventDetail],
  providers: [AuditLogsFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audit-logs-page.html',
  styleUrl: './audit-logs-page.css',
})
export class AuditLogsPage {
  protected readonly facade = inject(AuditLogsFacade);
  protected readonly offset = AUDIT_ZONE_OFFSET;
  protected readonly pageSize = AUDIT_PAGE_SIZE;
  protected readonly columns: readonly { key: AuditSortKey; label: string }[] = [
    { key: 'at', label: 'Timestamp' },
    { key: 'actor', label: 'Actor' },
    { key: 'action', label: 'Action' },
    { key: 'module', label: 'Module' },
  ];

  protected filter<K extends keyof AuditFilters>(key: K, event: Event): void {
    this.facade.setFilter(key, (event.target as HTMLInputElement | HTMLSelectElement).value as AuditFilters[K]);
  }

  protected ariaSort(key: AuditSortKey): 'ascending' | 'descending' | 'none' {
    const sort = this.facade.sort();
    return sort.key !== key ? 'none' : sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  protected arrow(key: AuditSortKey): string {
    const sort = this.ariaSort(key);
    return sort === 'ascending' ? '▲' : sort === 'descending' ? '▼' : '';
  }

  protected choose(id: string): void {
    this.facade.selectedId.set(this.facade.selectedId() === id ? null : id);
  }

  protected onKey(event: KeyboardEvent, id: string): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.choose(id);
  }

  protected exportCsv(): void {
    const blob = new Blob([this.facade.exportCsv()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sentinel-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
