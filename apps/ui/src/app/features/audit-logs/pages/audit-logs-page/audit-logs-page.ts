import { DatePipe, DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { AuditLogFacade } from '../../data-access/audit-log-facade';

const FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'HOLDS', label: 'Holds' },
  { id: 'DECISION', label: 'Decisions' },
  { id: 'INTERVENTION', label: 'Interventions' },
] as const;

/** Audit logs (M§5.8): who decided what, when, why and under which policy version, reproducible later. */
@Component({
  selector: 'sentinel-audit-logs-page',
  imports: [PageHeader, DatePipe],
  providers: [AuditLogFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sentinel-page-header
      heading="Audit logs"
      summary="Every decision and every intervention transition, with its actor, reason codes, policy and ruleset version, and the trace that joins logs and events."
    />
    <section class="sentinel-panel sentinel-section" aria-labelledby="audit-title">
      <header>
        <h2 id="audit-title">Audit trail</h2>
        <span class="sentinel-muted">{{ facade.entries().length }} of {{ facade.total() }} entries</span>
      </header>
      <div class="controls">
        <div class="filters" role="group" aria-label="Filter entries">
          @for (option of filters; track option.id) {
            <button type="button" class="filter" [attr.aria-pressed]="facade.filter() === option.id" (click)="facade.filter.set(option.id)">{{ option.label }}</button>
          }
        </div>
        <input type="search" placeholder="Search transaction, account, reason, trace…" aria-label="Search the audit trail" [value]="facade.query()" (input)="facade.query.set($any($event.target).value)" />
        <button type="button" class="sentinel-button" (click)="export()" [disabled]="facade.entries().length === 0">Export CSV</button>
      </div>
      @if (facade.entries().length === 0) {
        <p class="sentinel-empty">No entry matches.</p>
      } @else {
        <div class="sentinel-table-wrap">
          <table class="sentinel-table">
            <thead>
              <tr><th scope="col">Time (UTC)</th><th scope="col">Type</th><th scope="col">Transaction</th><th scope="col">Account</th><th scope="col">Action</th><th scope="col">Actor</th><th scope="col">Reason codes</th><th scope="col">Policy · ruleset</th><th scope="col">Trace / decision</th></tr>
            </thead>
            <tbody>
              @for (entry of facade.entries().slice(0, 300); track entry.id) {
                <tr [class.hold]="entry.action.includes('HOLD') || entry.action.includes('HELD')">
                  <td class="mono">{{ entry.at | date: 'dd MMM HH:mm:ss' : 'UTC' }}</td>
                  <td><span class="sentinel-chip" [attr.data-tone]="entry.kind === 'INTERVENTION' ? 'warning' : 'info'">{{ entry.kind.toLowerCase() }}</span></td>
                  <td class="mono small">{{ entry.transactionId }}</td>
                  <td class="mono">{{ entry.account }}</td>
                  <td>{{ entry.action }}</td>
                  <td>{{ entry.actor }}</td>
                  <td class="mono small">{{ entry.reasons || '—' }}</td>
                  <td class="mono small">{{ entry.policyVersion }} · {{ entry.rulesetVersion }}</td>
                  <td class="mono small ref">{{ entry.reference }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    .mono { font-family: var(--sentinel-font-family-mono); white-space: nowrap; }
    .ref { white-space: normal; }
    .small { font-size: var(--sentinel-font-size-micro); }
    .ref { max-width: 180px; overflow-wrap: anywhere; color: var(--sentinel-color-text-secondary); }
    tr.hold td:first-child { box-shadow: inset 3px 0 0 var(--sentinel-color-hold); }
    .controls { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sentinel-space-3); margin-bottom: var(--sentinel-space-3); }
    .filters { display: flex; gap: var(--sentinel-space-1); }
    .filter { min-height: 30px; padding: 0 var(--sentinel-space-3); border: 1px solid var(--sentinel-color-border); border-radius: var(--sentinel-radius-pill); background: transparent; color: var(--sentinel-color-text-secondary); font: inherit; font-size: var(--sentinel-font-size-caption); cursor: pointer; }
    .filter[aria-pressed='true'] { border-color: var(--sentinel-color-accent); background: var(--sentinel-color-accent-soft); color: var(--sentinel-color-text); }
    input { flex: 1; min-width: 220px; min-height: 32px; padding: 0 var(--sentinel-space-3); border: 1px solid var(--sentinel-color-border); border-radius: var(--sentinel-radius-small); background: var(--sentinel-color-surface); color: var(--sentinel-color-text); font: inherit; font-size: var(--sentinel-font-size-caption); }
  `,
})
export class AuditLogsPage {
  protected readonly facade = inject(AuditLogFacade);
  protected readonly filters = FILTERS;
  private readonly document = inject(DOCUMENT);

  protected export(): void {
    const url = URL.createObjectURL(new Blob([this.facade.csv()], { type: 'text/csv' }));
    const link = Object.assign(this.document.createElement('a'), { href: url, download: `sentinel-audit-${new Date().toISOString().slice(0, 19)}.csv` });
    link.click();
    URL.revokeObjectURL(url);
  }
}
