import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { CaseSummary } from '@sentinel/domain';

/**
 * A grounded case summary: confidence, the hypothesis, numbered evidence each showing the bundle field it cites,
 * and investigative next steps. Used by the deep-tier summary and by the investigation agent's findings.
 */
@Component({
  selector: 'sentinel-case-summary-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="provenance">
      Confidence {{ summary().confidence }}{{ summary().escalate ? ' · escalation suggested' : '' }}
      @if (droppedClaims() > 0) {
        · {{ droppedClaims() }} ungrounded {{ droppedClaims() === 1 ? 'claim' : 'claims' }} removed
      }
    </p>
    <p class="prose">{{ summary().hypothesis }}</p>
    <ol class="evidence">
      @for (item of summary().evidence; track $index) {
        <li>
          <span>{{ item.claim }}</span>
          <span class="source sentinel-mono">{{ item.sourceField }} = {{ item.value }}</span>
        </li>
      }
    </ol>
    @if (summary().recommendedActions.length > 0) {
      <ul class="actions">
        @for (action of summary().recommendedActions; track $index) {
          <li>{{ action }}</li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--sentinel-space-2);
    }
    p {
      margin: 0;
    }
    .provenance {
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-micro);
    }
    .prose {
      line-height: var(--sentinel-line-height-body);
    }
    .evidence,
    .actions {
      display: grid;
      gap: var(--sentinel-space-2);
      margin: 0;
      padding-left: var(--sentinel-space-4);
      font-size: var(--sentinel-font-size-caption);
    }
    .evidence li span {
      display: block;
    }
    .source {
      color: var(--sentinel-color-accent);
      font-size: var(--sentinel-font-size-micro);
      overflow-wrap: anywhere;
    }
  `,
})
export class CaseSummaryView {
  readonly summary = input.required<CaseSummary>();
  readonly droppedClaims = input(0);
}
