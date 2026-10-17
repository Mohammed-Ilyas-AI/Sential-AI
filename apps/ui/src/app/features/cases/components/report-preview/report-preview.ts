import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { AdvisoryFallbackReason } from '@sentinel/domain';
import type { SummaryState } from '../../data-access/cases-facade';

const FALLBACK_REASON: Readonly<Record<AdvisoryFallbackReason, string>> = {
  MODEL_NOT_CONFIGURED: 'No Gemini model is configured for this environment.',
  MODEL_UNAVAILABLE: 'Gemini did not answer in time, twice.',
  INVALID_RESPONSE: 'Gemini’s answer failed schema or grounding checks, twice.',
};

/** The advisory part of the report, requested on demand and labelled as advisory. */
@Component({
  selector: 'sentinel-report-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <span class="sentinel-muted">Deep tier · grounded in the evidence bundle · advisory only</span>
      <button type="button" class="sentinel-button" (click)="summarise.emit()" [disabled]="state().status === 'LOADING'">
        {{ state().status === 'LOADING' ? 'Drafting…' : 'Draft summary with Gemini' }}
      </button>
    </div>
    @switch (state().status) {
      @case ('IDLE') {
        <p class="sentinel-empty">The report renders the recorded facts on its own. Ask Gemini to add a grounded hypothesis.</p>
      }
      @case ('FAILED') {
        <p class="fallback" role="status">sentinel-core could not be reached. The report carries the recorded facts only.</p>
      }
      @case ('READY') {
        @if (outcome(); as outcome) {
          @if (outcome.status === 'FALLBACK') {
            <p class="fallback" role="status">{{ fallback[outcome.reason] }} The report carries the recorded facts only.</p>
          } @else {
            <p class="hypothesis">{{ outcome.advisory.hypothesis }}</p>
            <ol>
              @for (item of outcome.advisory.evidence; track $index) {
                <li>{{ item.claim }} <code>{{ item.sourceField }} = {{ item.value }}</code></li>
              }
            </ol>
          }
        }
      }
    }
  `,
  styles: `
    .row { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: var(--sentinel-space-2); margin-bottom: var(--sentinel-space-2); }
    .fallback { margin: 0; padding: var(--sentinel-space-2) var(--sentinel-space-3); border-left: 3px solid var(--sentinel-color-warning); background: color-mix(in srgb, var(--sentinel-color-warning) 8%, transparent); font-size: var(--sentinel-font-size-caption); }
    .hypothesis { margin: 0 0 var(--sentinel-space-2); line-height: var(--sentinel-line-height-body); }
    ol { display: grid; gap: var(--sentinel-space-1); margin: 0; padding-left: var(--sentinel-space-4); font-size: var(--sentinel-font-size-caption); }
    code { color: var(--sentinel-color-accent); font-size: var(--sentinel-font-size-micro); }
  `,
})
export class ReportPreview {
  readonly state = input.required<SummaryState>();
  readonly summarise = output();
  protected readonly fallback = FALLBACK_REASON;
  protected outcome() {
    const state = this.state();
    return state.status === 'READY' ? state.outcome : null;
  }
}
