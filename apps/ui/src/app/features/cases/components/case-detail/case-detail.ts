import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { InstitutionLabelPipe } from '../../../../shared/pipes/institution-label/institution-label-pipe';
import { CasesFacade } from '../../data-access/cases-facade';

@Component({
  selector: 'sentinel-case-detail',
  imports: [InstitutionLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="detail surface" aria-labelledby="case-detail-title">
      @if (facade.selectedCase(); as investigationCase) {
        <h2 id="case-detail-title">Case details</h2>
        <dl>
          <div><dt>Case</dt><dd class="mono">{{ investigationCase.id }}</dd></div>
          <div><dt>Account</dt><dd>{{ investigationCase.accountReference ?? investigationCase.accountId }}</dd></div>
          <div><dt>Institution</dt><dd>{{ investigationCase.institutionId | institutionLabel }}</dd></div>
          <div><dt>Status</dt><dd>{{ investigationCase.status }}</dd></div>
          <div><dt>Assessment</dt><dd>{{ investigationCase.evidence.assessment.score }}/100 · {{ investigationCase.evidence.assessment.band }}</dd></div>
          <div><dt>Rapid-drain gate</dt><dd>{{ investigationCase.evidence.drain.thresholdMet ? 'Threshold met' : 'Threshold not met' }}</dd></div>
        </dl>
        @if (investigationCase.status === 'OPEN' || investigationCase.status === 'ESCALATED') {
          <button type="button" class="secondary" [disabled]="facade.busy() || investigationCase.status === 'ESCALATED'" (click)="facade.escalate()">Escalate case</button>
        }
      } @else {
        <p class="empty">Select a case to inspect its recorded evidence.</p>
      }
      <hr />
      <label class="open">
        <span>Open a case from an alert</span>
        <select aria-label="Alert to open as a case" [value]="alertId()" (change)="alertId.set($any($event.target).value)">
          <option value="">Choose an open alert</option>
          @for (alert of facade.openAlerts(); track alert.id) {
            <option [value]="alert.id">{{ alert.accountReference ?? alert.accountId }} · score {{ alert.score }}</option>
          }
        </select>
      </label>
      <button type="button" class="primary" [disabled]="!alertId() || facade.busy()" (click)="openCase()">Open case</button>
    </section>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .detail { display: grid; gap: 12px; padding: 16px; border: 1px solid var(--sentinel-surface-panel-border); border-radius: 12px; background: var(--sentinel-color-surface); }
    h2 { margin: 0; font-size: 1rem; }
    dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 0; }
    dt { color: var(--sentinel-color-text-secondary); font-size: .7rem; text-transform: uppercase; }
    dd { margin: 3px 0 0; font-size: .82rem; overflow-wrap: anywhere; }
    .mono { font-family: var(--sentinel-font-mono, monospace); }
    .open { display: grid; gap: 6px; font-size: .75rem; }
    select, button { min-height: 36px; padding: 0 10px; border: 1px solid var(--sentinel-surface-panel-border); border-radius: 8px; background: var(--sentinel-color-surface); color: var(--sentinel-color-text); font: inherit; }
    button { cursor: pointer; font-size: .78rem; font-weight: 700; }
    button:disabled { opacity: .5; cursor: not-allowed; }
    .primary { border-color: var(--sentinel-color-accent); background: var(--sentinel-color-accent); color: var(--sentinel-color-accent-text, white); }
    .empty { color: var(--sentinel-color-text-secondary); font-size: .85rem; }
    hr { width: 100%; border: 0; border-top: 1px solid var(--sentinel-surface-panel-border); }
    @media (max-width: 640px) { dl { grid-template-columns: 1fr; } }
  `],
})
export class CaseDetail {
  protected readonly facade = inject(CasesFacade);
  protected readonly alertId = signal('');

  protected openCase(): void {
    const alertId = this.alertId();
    if (!alertId) return;
    this.facade.openFromAlert(alertId);
  }
}
