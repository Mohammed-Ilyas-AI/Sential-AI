import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AccountSummary } from '../../components/account-summary/account-summary';
import { EvidencePanel } from '../../components/evidence-panel/evidence-panel';
import { GeminiAdvisory } from '../../components/gemini-advisory/gemini-advisory';
import { Timeline } from '../../components/timeline/timeline';

/** The investigation workspace (M§5.4). */
@Component({
  selector: 'sentinel-investigation-page',
  imports: [AccountSummary, EvidencePanel, GeminiAdvisory, Timeline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sentinel-account-summary />
    <sentinel-evidence-panel />
    <sentinel-gemini-advisory />
    <sentinel-timeline />
  `,
})
export class InvestigationPage {}
