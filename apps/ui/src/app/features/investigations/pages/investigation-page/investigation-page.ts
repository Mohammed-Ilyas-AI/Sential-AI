import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { AccountSummary } from '../../components/account-summary/account-summary';
import { EvidencePanel } from '../../components/evidence-panel/evidence-panel';
import { GeminiAdvisory } from '../../components/gemini-advisory/gemini-advisory';
import { Timeline } from '../../components/timeline/timeline';

/** The investigation workspace (M§5.4). */
@Component({
  selector: 'sentinel-investigation-page',
  imports: [PageHeader, AccountSummary, EvidencePanel, GeminiAdvisory, Timeline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sentinel-page-header
      heading="Investigations"
      summary="Evidence assembled before any model call, the advisory explanation, and the account timeline."
      status="Arrives with the intelligence path (build steps 9–10)."
    />
    <sentinel-account-summary />
    <sentinel-evidence-panel />
    <sentinel-gemini-advisory />
    <sentinel-timeline />
  `,
})
export class InvestigationPage {}
