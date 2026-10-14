import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { AccountSummary } from '../../components/account-summary/account-summary';
import { EvidencePanel } from '../../components/evidence-panel/evidence-panel';
import { GeminiAdvisory } from '../../components/gemini-advisory/gemini-advisory';
import { Timeline } from '../../components/timeline/timeline';
import { InvestigationsFacade } from '../../data-access/investigations-facade';

/** The investigation workspace (M§5.4): evidence assembled before any model call, then advice on request. */
@Component({
  selector: 'sentinel-investigation-page',
  imports: [PageHeader, RouterLink, AccountSummary, EvidencePanel, GeminiAdvisory, Timeline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sentinel-page-header
      heading="Investigations"
      summary="The evidence bundle for the account in focus, the deterministic attribution, and Gemini's advisory on request."
    />
    @if (facade.decision(); as decision) {
      @switch (facade.evidenceStatus()) {
        @case ('LOADING') {
          <p class="state" role="status">Compiling the evidence bundle…</p>
        }
        @case ('FAILED') {
          <p class="state" role="alert">sentinel-core could not compile the evidence bundle for this assessment.</p>
        }
        @case ('READY') {
          @if (facade.evidence(); as evidence) {
            <div class="layout">
              <div class="column">
                <sentinel-account-summary [decision]="decision" [evidence]="evidence" />
                <sentinel-evidence-panel [evidence]="evidence" />
              </div>
              <div class="column">
                <sentinel-gemini-advisory
                  [explanation]="facade.explanation()"
                  [summary]="facade.summary()"
                  [agent]="facade.agent()"
                  (explain)="facade.explain()"
                  (summarise)="facade.summarise()"
                  (investigate)="facade.investigate()"
                />
                <sentinel-timeline [entries]="facade.timeline()" />
              </div>
            </div>
          }
        }
      }
    } @else {
      <p class="state">No account is in focus. Choose one in <a routerLink="/alerts">Alerts &amp; Cases</a>.</p>
    }
  `,
  styles: `
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
      gap: var(--sentinel-space-4);
      align-items: start;
    }
    .column {
      display: grid;
      gap: var(--sentinel-space-3);
      min-width: 0;
    }
    .state {
      color: var(--sentinel-color-text-secondary);
    }
    a {
      color: var(--sentinel-color-accent);
    }
    @media (max-width: 1023px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class InvestigationPage {
  protected readonly facade = inject(InvestigationsFacade);
}
