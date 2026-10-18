import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CaseList } from '../../components/case-list/case-list';
import { CaseReportPanel } from '../../components/case-report/case-report';
import { CasesFacade } from '../../data-access/cases-facade';

/** Cases and the one-click case report (M§5.6): rules decide, AI explains, the analyst signs. */
@Component({
  selector: 'sentinel-cases-page',
  imports: [CaseList, CaseReportPanel],
  providers: [CasesFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <p class="eyebrow">Investigation</p>
      <h1>Cases</h1>
      <p class="lede">Case files opened from alerts, and the report an analyst reviews, edits, signs off and exports.</p>
    </header>
    <div class="workspace">
      <sentinel-case-list class="surface" />
      <sentinel-case-report class="surface" />
    </div>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      gap: 12px;
      margin: calc(-1 * var(--sentinel-space-4)) calc(-1 * var(--sentinel-space-6));
      padding: var(--sentinel-space-4) var(--sentinel-space-6);
      background: var(--sentinel-color-background);
    }
    .eyebrow {
      margin: 0 0 2px;
      color: var(--sentinel-color-text-secondary);
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      font-size: clamp(1.375rem, 1rem + 0.9vw, 1.875rem);
      letter-spacing: -0.02em;
    }
    .lede {
      margin: 4px 0 0;
      color: var(--sentinel-color-text-secondary);
      font-size: 0.875rem;
    }
    .workspace {
      display: grid;
      grid-template-columns: 340px minmax(0, 1fr);
      gap: 12px;
      min-height: 0;
    }
    .surface {
      min-height: 0;
      border: 1px solid var(--sentinel-surface-panel-border);
      border-radius: var(--sentinel-radius-large);
      background: var(--sentinel-color-surface);
    }
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
      .workspace {
        grid-template-columns: minmax(0, 1fr);
      }
      sentinel-case-list {
        max-height: 420px;
      }
    }
  `,
})
export class CasesPage {}
