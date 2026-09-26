import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CaseDetail } from '../../components/case-detail/case-detail';
import { CaseList } from '../../components/case-list/case-list';
import { CaseTimeline } from '../../components/case-timeline/case-timeline';
import { ReportPreview } from '../../components/report-preview/report-preview';
import { SignOff } from '../../components/sign-off/sign-off';

/** Cases and the one-click case report (M§5.6). */
@Component({
  selector: 'sentinel-cases-page',
  imports: [CaseList, CaseDetail, CaseTimeline, ReportPreview, SignOff],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sentinel-case-list />
    <sentinel-case-detail />
    <sentinel-case-timeline />
    <sentinel-report-preview />
    <sentinel-sign-off />
  `,
})
export class CasesPage {}
