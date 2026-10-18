import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Icon } from '../../../../shared/ui/icon/icon';
import { AUDIT_ZONE_OFFSET, AuditLogsFacade } from '../../data-access/audit-logs-facade';

/** The selected event exactly as recorded. Read-only: there is no edit or delete for an audit record. */
@Component({
  selector: 'sentinel-audit-event-detail',
  imports: [DatePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (facade.selected(); as event) {
      <header>
        <div>
          <span class="kind">{{ event.module }} · {{ event.category }}</span>
          <h2>{{ event.action }}</h2>
        </div>
        <button type="button" class="close" aria-label="Close event details" (click)="facade.selectedId.set(null)"><sentinel-icon name="close" [size]="16" /></button>
      </header>
      <p class="severity" [attr.data-severity]="event.severity">{{ event.severity }} · {{ event.result }}</p>
      <div class="body sentinel-scroll">
        <dl>
          <div><dt>Recorded at</dt><dd class="mono">{{ event.at | date: 'd MMM y, HH:mm:ss.SSS' : offset[facade.zone()] }} {{ facade.zone() }}</dd></div>
          <div><dt>Stored value</dt><dd class="mono">{{ event.at }}</dd></div>
          <div><dt>Resource</dt><dd class="mono">{{ event.resource }}</dd></div>
          <div><dt>Details</dt><dd>{{ event.details }}</dd></div>
          @for (fact of event.facts; track fact.label) {
            <div><dt>{{ fact.label }}</dt><dd class="mono">{{ fact.value }}</dd></div>
          }
          <div><dt>Event id</dt><dd class="mono">{{ event.id }}</dd></div>
        </dl>
        <p class="note"><sentinel-icon name="lock" [size]="13" /> Audit records are immutable. They can be read and exported here, never edited or deleted.</p>
      </div>
      <div class="actions">
        @if (event.accountId) {
          <button type="button" (click)="facade.openInvestigation(event)"><sentinel-icon name="investigate" [size]="16" /> Investigation</button>
        }
        @if (event.transactionId) {
          <button type="button" (click)="facade.openTransaction(event)"><sentinel-icon name="activity" [size]="16" /> Transaction</button>
        }
        @if (event.category === 'INTERVENTION') {
          <button type="button" (click)="facade.openIntervention()"><sentinel-icon name="intervention" [size]="16" /> Interventions</button>
        }
      </div>
    } @else {
      <div class="placeholder">
        <sentinel-icon name="audit" [size]="28" />
        <p>Select an event to see what was recorded.</p>
      </div>
    }
  `,
  styleUrl: './audit-event-detail.css',
})
export class AuditEventDetail {
  protected readonly facade = inject(AuditLogsFacade);
  protected readonly offset = AUDIT_ZONE_OFFSET;
}
