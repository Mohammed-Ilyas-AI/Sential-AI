import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { AdvisoryFallbackReason, CaseSummary, RiskExplanation } from '@sentinel/domain';
import type { AdvisoryState } from '../../models/investigation-view';

const FALLBACK_REASON: Readonly<Record<AdvisoryFallbackReason, string>> = {
  MODEL_NOT_CONFIGURED: 'No Gemini model is configured for this environment.',
  MODEL_CREDENTIALS_UNAVAILABLE: 'sentinel-core has no Google credentials for Vertex AI (locally: gcloud auth application-default login).',
  MODEL_TIMED_OUT: 'Gemini did not finish within the server’s request limit. Try again; the sentinel-core log has the details.',
  MODEL_UNAVAILABLE: 'Gemini returned an error or could not be reached. The sentinel-core log has the cause.',
  INVALID_RESPONSE: 'Gemini’s answer failed schema or grounding checks, twice.',
};

/**
 * The advisory layer: hypothesis, numbered evidence tied to real bundle fields, recommended analyst actions.
 * Advisory only. Every claim shows its sourceField; it never recommends releasing a hold; a fallback says so.
 */
@Component({
  selector: 'sentinel-gemini-advisory',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="advisory-title">
      <header>
        <h2 id="advisory-title">Gemini advisory</h2>
        <span class="tag">Rules decide · AI explains · Humans authorise</span>
      </header>

      <div class="block">
        <div class="row">
          <h3>Score explanation <span class="tier">fast tier</span></h3>
          <button type="button" (click)="explain.emit()" [disabled]="explanation().status === 'LOADING'">
            {{ explanation().status === 'LOADING' ? 'Explaining…' : 'Explain' }}
          </button>
        </div>
        @switch (explanation().status) {
          @case ('LOADING') {
            <p class="provenance" role="status" aria-live="polite">{{ waiting }}</p>
          }
          @case ('FAILED') {
            <p class="fallback" role="status">sentinel-core could not be reached. The deterministic attribution stands.</p>
          }
          @case ('READY') {
            @if (explanation().outcome; as outcome) {
              @if (outcome.status === 'FALLBACK') {
                <p class="fallback" role="status">{{ fallbackReason[outcome.reason] }} The deterministic attribution is the explanation of record.</p>
              } @else {
                <p class="provenance">{{ outcome.status === 'CACHED' ? 'Cached for this assessment' : 'Generated, schema-validated' }}</p>
                <p class="prose">{{ outcome.advisory.primaryReason }}</p>
                <p class="action"><b>Next step:</b> {{ outcome.advisory.recommendedAction }}</p>
              }
            }
          }
        }
      </div>

      <div class="block">
        <div class="row">
          <h3>Case summary <span class="tier">deep tier</span></h3>
          <button type="button" (click)="summarise.emit()" [disabled]="summary().status === 'LOADING'">
            {{ summary().status === 'LOADING' ? 'Summarising…' : 'Summarise case' }}
          </button>
        </div>
        @switch (summary().status) {
          @case ('LOADING') {
            <p class="provenance" role="status" aria-live="polite">{{ waiting }}</p>
          }
          @case ('FAILED') {
            <p class="fallback" role="status">sentinel-core could not be reached. The deterministic attribution stands.</p>
          }
          @case ('READY') {
            @if (summary().outcome; as outcome) {
              @if (outcome.status === 'FALLBACK') {
                <p class="fallback" role="status">{{ fallbackReason[outcome.reason] }} The deterministic attribution is the explanation of record.</p>
              } @else {
                <p class="provenance">
                  Confidence {{ outcome.advisory.confidence }}{{ outcome.advisory.escalate ? ' · escalation suggested' : '' }}
                  @if (outcome.droppedClaims > 0) {
                    · {{ outcome.droppedClaims }} ungrounded {{ outcome.droppedClaims === 1 ? 'claim' : 'claims' }} removed
                  }
                </p>
                <p class="prose">{{ outcome.advisory.hypothesis }}</p>
                <ol class="evidence">
                  @for (item of outcome.advisory.evidence; track $index) {
                    <li>
                      <span>{{ item.claim }}</span>
                      <span class="source sentinel-mono">{{ item.sourceField }} = {{ item.value }}</span>
                    </li>
                  }
                </ol>
                @if (outcome.advisory.recommendedActions.length > 0) {
                  <ul class="actions">
                    @for (action of outcome.advisory.recommendedActions; track $index) {
                      <li>{{ action }}</li>
                    }
                  </ul>
                }
              }
            }
          }
        }
      </div>
    </section>
  `,
  styles: `
    .card {
      padding: var(--sentinel-space-4);
      border: 1px solid var(--sentinel-color-border);
      border-radius: var(--sentinel-radius-medium);
      background: var(--sentinel-color-surface);
    }
    header,
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--sentinel-space-2);
    }
    h2,
    h3 {
      margin: 0;
      font-size: var(--sentinel-font-size-body);
    }
    h3 {
      font-size: var(--sentinel-font-size-caption);
    }
    .tag,
    .tier,
    .provenance {
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-micro);
      font-weight: 400;
    }
    .block {
      display: grid;
      gap: var(--sentinel-space-2);
      margin-top: var(--sentinel-space-4);
      padding-top: var(--sentinel-space-3);
      border-top: 1px solid var(--sentinel-color-border-soft);
    }
    p {
      margin: 0;
    }
    .prose {
      line-height: var(--sentinel-line-height-body);
    }
    .action,
    .fallback {
      font-size: var(--sentinel-font-size-caption);
    }
    .fallback {
      padding: var(--sentinel-space-2) var(--sentinel-space-3);
      border-left: 3px solid var(--sentinel-color-warning);
      background: color-mix(in srgb, var(--sentinel-color-warning) 8%, transparent);
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
    button {
      min-height: 32px;
      padding: 0 var(--sentinel-space-3);
      border: 1px solid var(--sentinel-color-accent);
      border-radius: var(--sentinel-radius-small);
      background: var(--sentinel-color-accent-soft);
      color: var(--sentinel-color-text);
      font: inherit;
      font-size: var(--sentinel-font-size-caption);
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.6;
      cursor: default;
    }
    button:focus-visible {
      outline: 2px solid var(--sentinel-color-accent);
      outline-offset: 2px;
    }
  `,
})
export class GeminiAdvisory {
  readonly explanation = input.required<AdvisoryState<RiskExplanation>>();
  readonly summary = input.required<AdvisoryState<CaseSummary>>();
  readonly explain = output();
  readonly summarise = output();
  protected readonly fallbackReason = FALLBACK_REASON;
  protected readonly waiting = 'Gemini is reasoning over the evidence bundle; this can take up to a minute. The deterministic attribution stands meanwhile.';
}
