import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { CaseDetail } from '../../components/case-detail/case-detail';
import { CaseList } from '../../components/case-list/case-list';
import { CaseTimeline } from '../../components/case-timeline/case-timeline';
import { ReportPreview } from '../../components/report-preview/report-preview';
import { SignOff } from '../../components/sign-off/sign-off';
import { CasesApi } from '../../data-access/cases-api';
import { CasesFacade } from '../../data-access/cases-facade';

/** Cases and the one-click case report (M§5.6). */
@Component({
  selector: 'sentinel-cases-page',
  imports: [PageHeader, CaseList, CaseDetail, CaseTimeline, ReportPreview, SignOff],
  providers: [CasesApi, CasesFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sentinel-page-header
      heading="Cases"
      summary="Case files, their timeline and the analyst-signed case report."
      status="Evidence-backed workflow"
    />
    <main class="workspace">
      <div class="column">
        <sentinel-case-list />
        <sentinel-case-detail />
        <sentinel-sign-off />
      </div>
      <div class="column">
        <sentinel-case-timeline />
        <sentinel-report-preview />
      </div>
    </main>
  `,
  styles: [`
    :host { display: grid; gap: 14px; min-width: 0; }
    .workspace { display: grid; grid-template-columns: minmax(250px, .8fr) minmax(0, 1.7fr); align-items: start; gap: 14px; }
    .column { display: grid; align-content: start; gap: 14px; min-width: 0; }
    @media (max-width: 900px) { .workspace { grid-template-columns: 1fr; } }
  `],
})
export class CasesPage {}
