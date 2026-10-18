import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { EvidenceBundle } from '@sentinel/domain';
import { RiskAttribution } from '../../../../shared/ui/risk-attribution/risk-attribution';

/**
 * The deterministic attribution: the explanation of record, with or without Gemini. contributions[] exactly as
 * the rule engine wrote them; nothing in the advisory can change them.
 */
@Component({
  selector: 'sentinel-attribution-panel',
  imports: [RiskAttribution],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="attribution-title">
      <header>
        <h2 id="attribution-title">Deterministic attribution</h2>
        <span class="tag">Rules engine · {{ evidence().assessment.score }} / 100</span>
      </header>
      <p class="note">As the rule engine wrote them; nothing below can change them.</p>
      <div class="scroll sentinel-scroll">
        <sentinel-risk-attribution layout="rows" [contributions]="evidence().assessment.contributions" [score]="evidence().assessment.score" />
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
      min-height: 0;
    }
    .card {
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      height: 100%;
      padding: var(--sentinel-space-3) var(--sentinel-space-4);
      border: 1px solid var(--sentinel-surface-panel-border);
      border-radius: var(--sentinel-radius-large);
      background: var(--sentinel-surface-card);
      box-shadow: var(--sentinel-elevation-panel);
      min-width: 0;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sentinel-space-3);
    }
    h2 {
      margin: 0;
      font-size: var(--sentinel-font-size-title);
      font-weight: 600;
    }
    .tag {
      padding: 4px 12px;
      border: 1px solid var(--sentinel-color-border);
      border-radius: var(--sentinel-radius-pill);
      color: var(--sentinel-color-text-secondary);
      font-size: var(--sentinel-font-size-micro);
      font-weight: 600;
      white-space: nowrap;
    }
    .scroll {
      flex: 1;
      min-height: 0;
      overflow: auto;
    }
    .note {
      margin: 2px 0 var(--sentinel-space-2);
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-caption);
    }
  `,
})
export class AttributionPanel {
  readonly evidence = input.required<EvidenceBundle>();
}
