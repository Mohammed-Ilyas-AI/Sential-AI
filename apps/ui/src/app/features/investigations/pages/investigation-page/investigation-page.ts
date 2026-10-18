import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { AccountSummary } from '../../components/account-summary/account-summary';
import { AdvisoryDialog, type AdvisoryKind } from '../../components/advisory-dialog/advisory-dialog';
import { AttributionPanel } from '../../components/attribution-panel/attribution-panel';
import { EvidencePanel } from '../../components/evidence-panel/evidence-panel';
import { GeminiAdvisory } from '../../components/gemini-advisory/gemini-advisory';
import { Timeline } from '../../components/timeline/timeline';
import { InvestigationsFacade } from '../../data-access/investigations-facade';

/**
 * The investigation workspace (M§5.4): evidence assembled before any model call, then advice on request. The
 * deterministic assessment sits on the left, Gemini's advisory on the right; neither can change the other.
 */
@Component({
  selector: 'sentinel-investigation-page',
  imports: [PageHeader, RouterLink, AccountSummary, AdvisoryDialog, AttributionPanel, EvidencePanel, GeminiAdvisory, Timeline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sentinel-page-header
      heading="Investigations"
      summary="Evidence bundle, deterministic risk attribution, and Gemini's advisory on request."
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
            <div class="workspace">
              <sentinel-account-summary [decision]="decision" [evidence]="evidence" />
              <div class="layout">
                <sentinel-attribution-panel class="attribution" [evidence]="evidence" />
                <sentinel-gemini-advisory
                  class="advisory"
                  [explanation]="facade.explanation()"
                  [summary]="facade.summary()"
                  (explain)="openAdvisory('EXPLAIN')"
                  (summarise)="openAdvisory('SUMMARY')"
                />
                <sentinel-timeline class="timeline" [entries]="facade.timeline()" />
                <sentinel-evidence-panel class="bundle" [evidence]="evidence" />
              </div>
            </div>
            @if (dialog(); as kind) {
              <sentinel-advisory-dialog
                [kind]="kind"
                [decision]="decision"
                [explanation]="facade.explanation()"
                [summary]="facade.summary()"
                (retry)="openAdvisory($event)"
                (closed)="dialog.set(null)"
              />
            }
          }
        }
      }
    } @else {
      <p class="state">No account is in focus. Choose one in <a routerLink="/alerts">Alerts &amp; Cases</a> or <a routerLink="/live-transactions">Live Transactions</a>.</p>
    }
  `,
  styles: `
    /*
     * The page is the whole content surface: it bleeds into <main>'s padding so the evidence-network artwork
     * covers everything between the rail and the window edge, and on desktop it is exactly the height below the
     * top bar. The grid's cards scroll inside themselves; the document does not.
     */
    :host {
      --veil-strong: color-mix(in srgb, var(--sentinel-color-background) 94%, transparent);
      --veil-soft: color-mix(in srgb, var(--sentinel-color-background) 82%, transparent);
      /* Dark: the pale artwork is toned down to the edge; the light accent carries dark ink. */
      --veil-edge: color-mix(in srgb, var(--sentinel-color-background) 68%, transparent);
      --accent-ink: var(--sentinel-color-background);
      --sentinel-surface-card: color-mix(in srgb, var(--sentinel-color-surface) 90%, transparent);
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--sentinel-space-3);
      margin: calc(-1 * var(--sentinel-space-4)) calc(-1 * var(--sentinel-space-6));
      padding: var(--sentinel-space-4) var(--sentinel-space-6);
      background:
        linear-gradient(90deg, var(--veil-strong) 0%, var(--veil-strong) 30%, var(--veil-soft) 62%, var(--veil-edge) 100%),
        url('/backgrounds/investigations-bg.webp') right center / cover no-repeat,
        var(--sentinel-color-background);
    }
    :host-context([data-appearance='light']) {
      --veil-strong: color-mix(in srgb, var(--sentinel-color-background) 88%, transparent);
      --veil-soft: color-mix(in srgb, var(--sentinel-color-background) 50%, transparent);
      --veil-edge: transparent;
      --accent-ink: #fff;
    }
    sentinel-page-header {
      flex: none;
      margin-bottom: 0;
    }
    sentinel-account-summary {
      flex: none;
    }
    .workspace {
      display: flex;
      flex-direction: column;
      gap: var(--sentinel-space-3);
      flex: 1;
      min-height: 0;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr) minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr) auto;
      grid-template-areas:
        'attribution advisory timeline'
        'attribution bundle bundle';
      gap: var(--sentinel-space-3);
      flex: 1;
      min-height: 0;
    }
    .layout > * {
      min-width: 0;
      min-height: 0;
    }
    .advisory { grid-area: advisory; }
    .attribution { grid-area: attribution; }
    .timeline { grid-area: timeline; }
    .bundle { grid-area: bundle; }
    .state {
      color: var(--sentinel-color-text-secondary);
    }
    a {
      color: var(--sentinel-color-accent-text, var(--sentinel-color-accent));
    }
    /* Desktop: one viewport. 32px of <main>'s vertical padding is absorbed by the page. */
    @media (min-width: 1280px) and (min-height: 600px) {
      :host {
        height: calc(100dvh - var(--sentinel-top-bar-height));
        overflow: hidden;
      }
    }
    @media (max-width: 1279px) {
      :host {
        margin-inline: calc(-1 * var(--sentinel-space-4));
        padding-inline: var(--sentinel-space-4);
      }
      .layout {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        grid-template-rows: none;
        grid-template-areas:
          'attribution advisory'
          'timeline timeline'
          'bundle bundle';
      }
    }
    @media (max-width: 767px) {
      :host {
        margin: calc(-1 * var(--sentinel-space-4)) calc(-1 * var(--sentinel-space-3)) 0;
        padding: var(--sentinel-space-4) var(--sentinel-space-3);
      }
      .layout {
        grid-template-columns: minmax(0, 1fr);
        grid-template-areas: 'attribution' 'advisory' 'timeline' 'bundle';
      }
    }
  `,
})
export class InvestigationPage {
  protected readonly facade = inject(InvestigationsFacade);
  /** The advisory shown at reading size; closing it never cancels the request, the inline card keeps the result. */
  protected readonly dialog = signal<AdvisoryKind | null>(null);

  protected openAdvisory(kind: AdvisoryKind): void {
    if (kind === 'EXPLAIN') this.facade.explain();
    else this.facade.summarise();
    this.dialog.set(kind);
  }
}
