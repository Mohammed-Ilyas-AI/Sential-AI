import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { CaseDetail } from '../../components/case-detail/case-detail';
import { CaseList } from '../../components/case-list/case-list';
import { CaseTimeline } from '../../components/case-timeline/case-timeline';
import { ReportPreview } from '../../components/report-preview/report-preview';
import { SignOff } from '../../components/sign-off/sign-off';

/** Cases and the one-click case report (M§5.6). */
@Component({
  selector: 'sentinel-cases-page',
  imports: [PageHeader, CaseList, CaseDetail, CaseTimeline, ReportPreview, SignOff],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sentinel-page-header
      heading="Cases"
      summary="Case files, their timeline and the analyst-signed case report."
      status="Arrives with the investigation workspace."
    />
    <sentinel-case-list />
    <sentinel-case-detail />
    <sentinel-case-timeline />
    <sentinel-report-preview />
    <sentinel-sign-off />
  `,
})
export class CasesPage {}
