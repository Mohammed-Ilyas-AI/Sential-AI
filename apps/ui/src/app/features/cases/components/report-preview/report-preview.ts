import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CasesFacade } from '../../data-access/cases-facade';

@Component({
  selector: 'sentinel-report-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="report surface" aria-labelledby="report-title">
      <header>
        <div>
          <h2 id="report-title">Evidence-backed report</h2>
          @if (facade.report(); as report) {
            <p>Version {{ report.latest.version }} · revision {{ report.latest.revision }} · {{ report.latest.status }}</p>
          } @else {
            <p>Generated from persisted case evidence and recorded actions.</p>
          }
        </div>
        @if (facade.report(); as report) {
          <button type="button" [disabled]="facade.busy()" (click)="facade.exportReport()">Export saved report</button>
        }
      </header>
      @if (facade.report(); as report) {
        @if (report.latest.aiSummary.status === 'INCLUDED') {
          <aside class="advisory">
            <b>Previously archived AI summary · advisory only</b>
            <p>{{ report.latest.aiSummary.hypothesis }}</p>
            <small>{{ report.latest.aiSummary.confidence }} confidence · archived {{ report.latest.aiSummary.archivedAt }}</small>
          </aside>
        } @else {
          <p class="note">No previously archived grounded AI summary is available. Report generation does not call a model.</p>
        }
        <div class="sections">
          @for (section of report.latest.sections; track section.id) {
            <article>
              <label [for]="'section-' + section.id">{{ section.title }}</label>
              <textarea
                [id]="'section-' + section.id"
                [value]="facade.reportBody(section.id, section.body)"
                [readonly]="report.latest.status === 'SIGNED_OFF'"
                [disabled]="facade.busy()"
                maxlength="8000"
                rows="4"
                (input)="facade.editSection(section.id, $any($event.target).value)"
              ></textarea>
              @if (section.sources.length > 0) {
                <details>
                  <summary>{{ section.sources.length }} recorded source references</summary>
                  <ul>@for (source of section.sources; track source.field) { <li><code>{{ source.field }}</code> · {{ source.value }}</li> }</ul>
                </details>
              }
            </article>
          }
        </div>
      } @else if (facade.selectedCase()) {
        <div class="empty">
          <p>No report draft exists for this case yet.</p>
          <button type="button" class="primary" [disabled]="facade.busy() || !facade.analystIdentity().trim()" (click)="facade.generateReport()">Generate report draft</button>
        </div>
      } @else {
        <p class="empty">Select a case to review or generate its report.</p>
      }
    </section>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .report { display: grid; gap: 14px; padding: 16px; border: 1px solid var(--sentinel-surface-panel-border); border-radius: 12px; background: var(--sentinel-color-surface); }
    header { display: flex; align-items: start; justify-content: space-between; gap: 12px; }
    h2 { margin: 0; font-size: 1rem; }
    header p, .note, .empty, small { color: var(--sentinel-color-text-secondary); font-size: .75rem; }
    header p { margin: 4px 0 0; }
    button { min-height: 34px; padding: 0 10px; border: 1px solid var(--sentinel-surface-panel-border); border-radius: 8px; background: transparent; color: var(--sentinel-color-text); font: inherit; font-size: .75rem; font-weight: 700; cursor: pointer; }
    .primary { border-color: var(--sentinel-color-accent); background: var(--sentinel-color-accent); color: var(--sentinel-color-accent-text, white); }
    button:disabled { opacity: .5; cursor: not-allowed; }
    .sections { display: grid; gap: 12px; }
    article { display: grid; gap: 6px; }
    label { font-size: .8rem; font-weight: 700; }
    textarea { width: 100%; box-sizing: border-box; resize: vertical; padding: 10px; border: 1px solid var(--sentinel-surface-panel-border); border-radius: 8px; background: var(--sentinel-color-background); color: var(--sentinel-color-text); font: inherit; font-size: .8rem; line-height: 1.5; }
    textarea:read-only { opacity: .85; }
    details { color: var(--sentinel-color-text-secondary); font-size: .7rem; }
    details ul { padding-left: 18px; }
    code { font-family: var(--sentinel-font-mono, monospace); }
    .advisory { padding: 12px; border-left: 3px solid var(--sentinel-color-accent); background: color-mix(in srgb, var(--sentinel-color-accent) 8%, transparent); font-size: .8rem; }
    .advisory p { margin: 5px 0; }
    .note { margin: 0; }
    .empty { display: grid; gap: 8px; justify-items: start; }
    .empty p { margin: 0; }
  `],
})
export class ReportPreview {
  protected readonly facade = inject(CasesFacade);
}
