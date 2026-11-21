import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../../../shared/ui/icon/icon';
import { CaseList } from '../../components/case-list/case-list';
import { CaseReportPanel } from '../../components/case-report/case-report';
import { CasesFacade } from '../../data-access/cases-facade';

/** Cases and the one-click case report (M§5.6): rules decide, AI explains, the analyst signs. */
@Component({
  selector: 'sentinel-cases-page',
  imports: [RouterLink, Icon, CaseList, CaseReportPanel],
  providers: [CasesFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <div>
        <p class="eyebrow"><a routerLink="/alerts">Alerts &amp; Cases</a> <sentinel-icon name="chevronRightSmall" [size]="12" /> Investigation</p>
        <h1>Case <span>files</span></h1>
        <p class="lede">Open a case from an alert, generate its report from recorded facts, then review, sign off and export.</p>
      </div>
      <ol class="flow" aria-label="Case workflow">
        <li><sentinel-icon name="alert" [size]="14" /> Open</li>
        <li><sentinel-icon name="audit" [size]="14" /> Generate</li>
        <li><sentinel-icon name="check" [size]="14" /> Sign off</li>
        <li><sentinel-icon name="arrowDownRight" [size]="14" /> Export PDF</li>
      </ol>
    </header>

    <section class="metrics" aria-label="Case figures">
      <div class="metric" data-tone="info">
        <span class="tile"><sentinel-icon name="audit" [size]="18" /></span><span class="text"><small>Case files</small><b>{{ facade.counts().total }}</b></span>
      </div>
      <div class="metric" data-tone="accent">
        <span class="tile"><sentinel-icon name="investigate" [size]="18" /></span><span class="text"><small>Open</small><b>{{ facade.counts().open }}</b></span>
      </div>
      <div class="metric" data-tone="warning">
        <span class="tile"><sentinel-icon name="arrowUpRight" [size]="18" /></span><span class="text"><small>Escalated</small><b>{{ facade.counts().escalated }}</b></span>
      </div>
      <div class="metric" data-tone="success">
        <span class="tile"><sentinel-icon name="shieldCheck" [size]="18" /></span><span class="text"><small>Closed</small><b>{{ facade.counts().closed }}</b></span>
      </div>
      <div class="metric" data-tone="critical">
        <span class="tile"><sentinel-icon name="shieldAlert" [size]="18" /></span><span class="text"><small>Alerts without a case</small><b>{{ facade.openable().length }}</b></span>
      </div>
    </section>

    <div class="workspace">
      <sentinel-case-list class="surface" />
      <sentinel-case-report class="surface report" />
    </div>
  `,
  styleUrl: './cases-page.css',
})
export class CasesPage {
  protected readonly facade = inject(CasesFacade);
}
