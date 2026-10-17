import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { CaseDetail } from '../../components/case-detail/case-detail';
import { CaseList } from '../../components/case-list/case-list';
import { CaseTimeline } from '../../components/case-timeline/case-timeline';
import { ReportPreview } from '../../components/report-preview/report-preview';
import { SignOff } from '../../components/sign-off/sign-off';
import { renderCaseReport } from '../../data-access/case-report.renderer';
import { CasesFacade } from '../../data-access/cases-facade';

/** Cases and the one-click case report (M§5.6): recorded facts, an optional grounded Gemini draft, analyst sign-off. */
@Component({
  selector: 'sentinel-cases-page',
  imports: [PageHeader, CaseList, CaseDetail, CaseTimeline, ReportPreview, SignOff],
  providers: [CasesFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sentinel-page-header
      heading="Cases"
      summary="One case per alerted account: the recorded facts, an optional Gemini draft grounded in the evidence, and the analyst's signed report."
    />
    <div class="layout">
      <section class="sentinel-panel sentinel-section" aria-labelledby="cases-title">
        <header><h2 id="cases-title">Open cases</h2><span class="sentinel-muted">{{ facade.cases().length }}</span></header>
        <sentinel-case-list [cases]="facade.cases()" [selectedAccountId]="facade.focusedAccountId()" (selected)="facade.select($event)" />
      </section>
      @if (facade.selected(); as item) {
        <div class="detail">
          <section class="sentinel-panel sentinel-section" aria-labelledby="facts-title">
            <header>
              <h2 id="facts-title">Recorded facts</h2>
              <button type="button" class="sentinel-button" (click)="download()">Download report</button>
            </header>
            <sentinel-case-detail [item]="item" [decision]="facade.decision()" />
          </section>
          <section class="sentinel-panel sentinel-section" aria-labelledby="timeline-title">
            <header><h2 id="timeline-title">Timeline</h2></header>
            <sentinel-case-timeline [events]="facade.timeline()" />
          </section>
          <section class="sentinel-panel sentinel-section" aria-labelledby="advisory-title">
            <header><h2 id="advisory-title">Advisory summary</h2></header>
            <sentinel-report-preview [state]="facade.summary()" (summarise)="facade.summarise()" />
          </section>
          <section class="sentinel-panel sentinel-section" aria-labelledby="signoff-title">
            <header><h2 id="signoff-title">Analyst sign-off</h2></header>
            <sentinel-sign-off [signed]="facade.signOff()" [analystIdentity]="facade.analystIdentity()" (sign)="facade.sign($event.disposition, $event.note)" />
          </section>
        </div>
      } @else {
        <p class="sentinel-empty">Select a case to open its file.</p>
      }
    </div>
  `,
  styles: `
    .layout { display: grid; grid-template-columns: minmax(260px, 1fr) minmax(0, 2.4fr); gap: var(--sentinel-space-4); align-items: start; }
    .detail { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sentinel-space-4); align-items: start; }
    @media (max-width: 1200px) { .layout, .detail { grid-template-columns: 1fr; } }
  `,
})
export class CasesPage {
  protected readonly facade = inject(CasesFacade);
  private readonly document = inject(DOCUMENT);

  protected download(): void {
    const item = this.facade.selected();
    if (!item) return;
    const summary = this.facade.summary();
    const html = renderCaseReport({
      item,
      decision: this.facade.decision(),
      timeline: this.facade.timeline(),
      summary: summary.status === 'READY' && summary.outcome.status !== 'FALLBACK' ? summary.outcome.advisory : null,
      signOff: this.facade.signOff(),
      generatedAt: new Date().toISOString(),
    });
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const link = Object.assign(this.document.createElement('a'), { href: url, download: `${item.caseId}-report.html` });
    link.click();
    URL.revokeObjectURL(url);
  }
}
