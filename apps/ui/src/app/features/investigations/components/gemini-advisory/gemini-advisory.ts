import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { AdvisoryFallbackReason, AgentEvidenceTool, AgentInvestigation, AgentToolStep, CaseSummary, RiskExplanation } from '@sentinel/domain';
import type { AdvisoryState } from '../../models/investigation-view';
import { CaseSummaryView } from '../case-summary-view/case-summary-view';

const FALLBACK_REASON: Readonly<Record<AdvisoryFallbackReason, string>> = {
  MODEL_NOT_CONFIGURED: 'No Gemini model is configured for this environment.',
  MODEL_UNAVAILABLE: 'Gemini did not answer in time, twice.',
  INVALID_RESPONSE: 'Gemini’s answer failed schema or grounding checks, twice.',
};

/** What each read-only tool looked at, in the analyst's words. */
const TOOL_LABEL: Readonly<Record<AgentEvidenceTool, string>> = {
  get_risk_assessment: 'Read the risk assessment',
  get_drain_state: 'Checked the rapid-drain safeguard',
  get_account_profile: 'Read the account profile',
  get_recent_transactions: 'Reviewed recent transfers',
  get_device_history: 'Reviewed device and login events',
  get_payee_history: 'Reviewed payees added',
  get_prior_alerts: 'Checked prior alerts',
  get_interventions: 'Checked holds and interventions',
  get_network_neighbourhood: 'Mapped the entity network',
  inspect_network_entity: 'Followed the money to',
};

/**
 * The advisory layer: hypothesis, numbered evidence tied to real bundle fields, recommended analyst actions.
 * Advisory only. Every claim shows its sourceField; it never recommends releasing a hold; a fallback says so.
 */
@Component({
  selector: 'sentinel-gemini-advisory',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaseSummaryView],
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
          @case ('FAILED') {
            <p class="fallback" role="status">sentinel-core could not be reached. The deterministic attribution stands.</p>
          }
          @case ('READY') {
            @if (summary().outcome; as outcome) {
              @if (outcome.status === 'FALLBACK') {
                <p class="fallback" role="status">{{ fallbackReason[outcome.reason] }} The deterministic attribution is the explanation of record.</p>
              } @else {
                <sentinel-case-summary-view [summary]="outcome.advisory" [droppedClaims]="outcome.droppedClaims" />
              }
            }
          }
        }
      </div>

      <div class="block">
        <div class="row">
          <h3>Investigation agent <span class="tier">agentic · deep tier · read-only tools</span></h3>
          <button type="button" (click)="investigate.emit()" [disabled]="agent().status === 'LOADING'">
            {{ agent().status === 'LOADING' ? 'Agent investigating…' : 'Run agent' }}
          </button>
        </div>
        @switch (agent().status) {
          @case ('IDLE') {
            <p class="hint">Gemini plans its own investigation: it chooses which evidence to read, follows the money through the network, then files grounded findings. It cannot hold, release or change anything.</p>
          }
          @case ('LOADING') {
            <p class="hint" role="status">Gemini is gathering evidence through read-only tools…</p>
          }
          @case ('FAILED') {
            <p class="fallback" role="status">sentinel-core could not be reached. The deterministic attribution stands.</p>
          }
          @case ('READY') {
            @if (agent().outcome; as outcome) {
              @if (outcome.status === 'FALLBACK') {
                <p class="fallback" role="status">{{ fallbackReason[outcome.reason] }} The deterministic attribution is the explanation of record.</p>
              } @else {
                <p class="provenance">
                  {{ outcome.advisory.steps.length }} tool {{ outcome.advisory.steps.length === 1 ? 'call' : 'calls' }} over {{ outcome.advisory.rounds }}
                  {{ outcome.advisory.rounds === 1 ? 'turn' : 'turns' }} · findings schema-validated and grounded in what the agent read
                </p>
                <ol class="trace" aria-label="Agent evidence trace">
                  @for (step of outcome.advisory.steps; track $index) {
                    <li>
                      <span class="turn sentinel-mono">T{{ step.round }}</span>
                      <span>{{ toolLabel[step.tool] }} {{ entityOf(step) }}</span>
                      <span class="source sentinel-mono">{{ step.bundleField }} · {{ step.records }} {{ step.records === 1 ? 'record' : 'records' }}</span>
                    </li>
                  }
                </ol>
                <sentinel-case-summary-view [summary]="outcome.advisory.summary" [droppedClaims]="outcome.droppedClaims" />
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
    .provenance,
    .hint {
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
    .hint {
      font-size: var(--sentinel-font-size-caption);
      line-height: var(--sentinel-line-height-body);
    }
    .trace {
      display: grid;
      gap: var(--sentinel-space-1);
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: var(--sentinel-font-size-caption);
    }
    .trace li {
      display: grid;
      grid-template-columns: auto 1fr;
      column-gap: var(--sentinel-space-2);
    }
    .trace .source {
      grid-column: 2;
    }
    .turn {
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-micro);
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
  readonly agent = input.required<AdvisoryState<AgentInvestigation>>();
  readonly explain = output();
  readonly summarise = output();
  readonly investigate = output();
  protected readonly fallbackReason = FALLBACK_REASON;
  protected readonly toolLabel = TOOL_LABEL;

  protected entityOf(step: AgentToolStep): string {
    const entityId = step.args['entityId'];
    return step.tool === 'inspect_network_entity' && typeof entityId === 'string' ? entityId : '';
  }
}
