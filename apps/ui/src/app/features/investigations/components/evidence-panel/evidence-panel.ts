import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { EvidenceBundle } from '@sentinel/domain';
import { RiskAttribution } from '../../../../shared/ui/risk-attribution/risk-attribution';

/**
 * The evidence bundle exactly as sentinel-core compiled it: the same object Gemini receives, capped. The
 * deterministic attribution is first because it is the explanation of record, with or without Gemini.
 */
@Component({
  selector: 'sentinel-evidence-panel',
  imports: [JsonPipe, RiskAttribution],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="evidence-title">
      <h2 id="evidence-title">Deterministic attribution</h2>
      <p class="note">contributions[] as the rule engine wrote them. Nothing below can change them.</p>
      <sentinel-risk-attribution [contributions]="evidence().assessment.contributions" [score]="evidence().assessment.score" />
    </section>
    <section class="card" aria-labelledby="bundle-title">
      <h2 id="bundle-title">Evidence bundle</h2>
      <ul class="counts">
        @for (count of counts(); track count.label) {
          <li><b class="sentinel-figures">{{ count.value }}</b><span>{{ count.label }}</span></li>
        }
      </ul>
      @if (evidence().neighbourhood.truncated) {
        <p class="note">The graph neighbourhood was capped at 40 nodes; the least significant edges were dropped.</p>
      }
      <details>
        <summary>The object sent to Gemini</summary>
        <pre class="sentinel-mono sentinel-scroll">{{ evidence() | json }}</pre>
      </details>
    </section>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--sentinel-space-3);
    }
    .card {
      padding: var(--sentinel-space-4);
      border: 1px solid var(--sentinel-color-border);
      border-radius: var(--sentinel-radius-medium);
      background: var(--sentinel-color-surface);
      min-width: 0;
    }
    h2 {
      margin: 0 0 var(--sentinel-space-1);
      font-size: var(--sentinel-font-size-body);
    }
    .note {
      margin: 0 0 var(--sentinel-space-3);
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-caption);
    }
    .counts {
      list-style: none;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: var(--sentinel-space-2);
      margin: var(--sentinel-space-3) 0;
      padding: 0;
    }
    .counts li {
      display: grid;
      gap: 2px;
      padding: var(--sentinel-space-2) var(--sentinel-space-3);
      border: 1px solid var(--sentinel-color-border-soft);
      border-radius: var(--sentinel-radius-small);
    }
    .counts span {
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-micro);
    }
    summary {
      cursor: pointer;
      color: var(--sentinel-color-text-secondary);
      font-size: var(--sentinel-font-size-caption);
    }
    pre {
      max-height: 320px;
      overflow: auto;
      margin: var(--sentinel-space-2) 0 0;
      padding: var(--sentinel-space-3);
      border-radius: var(--sentinel-radius-small);
      background: var(--sentinel-color-background);
      font-size: var(--sentinel-font-size-micro);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  `,
})
export class EvidencePanel {
  readonly evidence = input.required<EvidenceBundle>();

  protected readonly counts = computed(() => {
    const evidence = this.evidence();
    return [
      { label: 'Recent transactions (cap 50)', value: evidence.recentTransactions.length },
      { label: 'Device events', value: evidence.deviceHistory.length },
      { label: 'Payees added', value: evidence.payeeHistory.length },
      { label: 'Prior alerts', value: evidence.priorAlerts.length },
      { label: 'Intervention records', value: evidence.interventions.length },
      { label: 'Graph nodes (cap 40)', value: evidence.neighbourhood.nodes.length },
    ];
  });
}
