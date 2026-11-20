import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import type { SentinelSwarmReport } from '@sentinel/domain';
import { Icon } from '../../../../shared/ui/icon/icon';

@Component({
  selector: 'sentinel-agent-swarm',
  imports: [DatePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="swarm-title">
      <header>
        <div class="title-line">
          <span class="spark" aria-hidden="true"><sentinel-icon name="radar" [size]="20" /></span>
          <div>
            <div class="heading-row">
              <h2 id="swarm-title">Google Cloud Vertex AI · 7-Agent Autonomous Swarm</h2>
              <span class="swarm-badge">Dual-Tier Gemini · 4-Stage Mesh</span>
            </div>
            <p class="subtitle">Autonomous parallel triage, customer defense challenge, capital containment &amp; MAS SRF statutory filing.</p>
          </div>
        </div>
        <button
          type="button"
          class="orchestrate-btn"
          (click)="orchestrate.emit()"
          [disabled]="status() === 'LOADING'"
        >
          @if (status() === 'LOADING') {
            <span class="spinner" aria-hidden="true"></span>
            <span>Orchestrating 7 Agents…</span>
          } @else {
            <span class="pulse-dot" aria-hidden="true"></span>
            <span>{{ report() ? 'Re-run Swarm Analysis' : 'Run 7-Agent Swarm Orchestrator' }}</span>
          }
        </button>
      </header>

      <!-- 4-Stage Pipeline Visual Tracker -->
      <nav class="pipeline-track" aria-label="Multi-Agent Pipeline Stages">
        <div class="stage-node done">
          <span class="stage-num">STAGE 1</span>
          <span class="stage-name">Parallel Triage</span>
          <small class="stage-model">Gemini 2.5 Flash</small>
        </div>
        <span class="stage-arrow" aria-hidden="true">➔</span>
        <div class="stage-node done">
          <span class="stage-num">STAGE 2</span>
          <span class="stage-name">Customer Defense</span>
          <small class="stage-model">Gemini 2.5 Pro</small>
        </div>
        <span class="stage-arrow" aria-hidden="true">➔</span>
        <div class="stage-node done">
          <span class="stage-num">STAGE 3</span>
          <span class="stage-name">Capital Containment</span>
          <small class="stage-model">Gemini 2.5 Pro</small>
        </div>
        <span class="stage-arrow" aria-hidden="true">➔</span>
        <div class="stage-node done">
          <span class="stage-num">STAGE 4</span>
          <span class="stage-name">Regulatory Sign-Off</span>
          <small class="stage-model">MAS SRF &amp; CAD STRO</small>
        </div>
      </nav>

      @if (status() === 'LOADING') {
        <div class="loading-state" role="status" aria-live="polite">
          <span class="spinner" aria-hidden="true"></span>
          <span>Orchestrating 7 Autonomous Agents on Vertex AI across sub-second triaging and regulatory synthesis…</span>
        </div>
      }

      @if (report(); as swarm) {
        <div class="threat-banner" [attr.data-threat]="swarm.overallThreatLevel">
          <div class="threat-info">
            <span class="threat-pill">THREAT LEVEL: {{ swarm.overallThreatLevel }}</span>
            <span class="threat-desc">7 Agents reached unanimous consensus · 4-Eyes Kill Switch engaged · S$52,000 Outflow Held</span>
          </div>
          <span class="threat-time">Evaluated at {{ swarm.evaluatedAt | date: 'HH:mm:ss' }}</span>
        </div>

        <div class="agents-grid">
          <!-- Agent 1 -->
          <article class="agent-card">
            <div class="card-top">
              <span class="stage-tag">STAGE 1 · FAST TIER</span>
              <span class="model-tag">Gemini Flash</span>
            </div>
            <h4>1. ATO Investigation</h4>
            <span class="pill danger" [attr.data-risk]="swarm.agents.ato.deviceRisk">{{ swarm.agents.ato.deviceRisk }}</span>
            <p>{{ swarm.agents.ato.authenticationLineage }}</p>
            <div class="agent-metric">
              <b>Confidence: {{ swarm.agents.ato.atoConfidenceScore }}%</b>
              <span>{{ swarm.agents.ato.isTakeoverLikely ? 'Takeover Likely' : 'Low Risk' }}</span>
            </div>
          </article>

          <!-- Agent 2 -->
          <article class="agent-card">
            <div class="card-top">
              <span class="stage-tag">STAGE 1 · FAST TIER</span>
              <span class="model-tag">Gemini Flash</span>
            </div>
            <h4>2. Beneficiary Intel</h4>
            <span class="pill warning" [attr.data-risk]="swarm.agents.beneficiary.payeeRiskTier">{{ swarm.agents.beneficiary.payeeRiskTier }}</span>
            <p>{{ swarm.agents.beneficiary.counterpartyAssessment }}</p>
            <div class="agent-metric">
              <b>Payee Risk: {{ swarm.agents.beneficiary.payeeRiskTier }}</b>
              <span>{{ swarm.agents.beneficiary.dormantPayeeActivated ? 'Dormant Activated' : 'Active Account' }}</span>
            </div>
          </article>

          <!-- Agent 3 -->
          <article class="agent-card">
            <div class="card-top">
              <span class="stage-tag">STAGE 1 · FAST TIER</span>
              <span class="model-tag">Gemini Flash</span>
            </div>
            <h4>3. Scam Intent</h4>
            <span class="pill danger" [attr.data-coercion]="swarm.agents.scamIntent.coercionIndex">{{ swarm.agents.scamIntent.coercionIndex }}</span>
            <p>{{ swarm.agents.scamIntent.behavioralAnomalySummary }}</p>
            <div class="agent-metric">
              <b>Typology: {{ swarm.agents.scamIntent.scamTypology }}</b>
              <span>Coercion: {{ swarm.agents.scamIntent.coercionIndex }}</span>
            </div>
          </article>

          <!-- Agent 4 -->
          <article class="agent-card">
            <div class="card-top">
              <span class="stage-tag">STAGE 1 · FAST TIER</span>
              <span class="model-tag">Gemini Flash</span>
            </div>
            <h4>4. Mule Tracing</h4>
            <span class="pill" [class.danger]="swarm.agents.muleTrace.identifiedMuleRing">{{ swarm.agents.muleTrace.identifiedMuleRing ? 'MULE RING DETECTED' : 'CLEAR' }}</span>
            <p>{{ swarm.agents.muleTrace.observabilityStopReason }}</p>
            <div class="agent-metric">
              <b>Observed Hops: {{ swarm.agents.muleTrace.observedHops }}</b>
              <span>Entities: {{ swarm.agents.muleTrace.pathEntities.length }}</span>
            </div>
          </article>

          <!-- Agent 5 -->
          <article class="agent-card">
            <div class="card-top">
              <span class="stage-tag">STAGE 2 · DEEP TIER</span>
              <span class="model-tag">Gemini Pro</span>
            </div>
            <h4>5. Customer Verify</h4>
            <span class="pill warning" [attr.data-call]="swarm.agents.verification.callOutcome">{{ swarm.agents.verification.callOutcome }}</span>
            <p>{{ swarm.agents.verification.verificationScript }}</p>
            <div class="agent-metric">
              <b>Channel: {{ swarm.agents.verification.channelUsed }}</b>
              <span>Action: {{ swarm.agents.verification.recommendedImmediateAction }}</span>
            </div>
          </article>

          <!-- Agent 6 -->
          <article class="agent-card">
            <div class="card-top">
              <span class="stage-tag">STAGE 3 · DEEP TIER</span>
              <span class="model-tag">Gemini Pro</span>
            </div>
            <h4>6. Recovery &amp; Recall</h4>
            <span class="pill" [class.danger]="swarm.agents.recovery.killSwitchEngaged">{{ swarm.agents.recovery.killSwitchEngaged ? 'KILL SWITCH ENGAGED' : 'STANDBY' }}</span>
            <p>Inter-bank pre-settlement recall dispatched: {{ swarm.agents.recovery.interbankRecallStatus }}.</p>
            <div class="agent-metric">
              <b>Recall: {{ swarm.agents.recovery.interbankRecallStatus }}</b>
              <span>Holds Placed: {{ swarm.agents.recovery.cascadedHoldsPlaced }}</span>
            </div>
          </article>

          <!-- Agent 7 -->
          <article class="agent-card full-width">
            <div class="card-top">
              <span class="stage-tag">STAGE 4 · DEEP TIER</span>
              <span class="model-tag">Gemini Pro · MAS Compliance</span>
            </div>
            <div class="reporting-header">
              <div>
                <h4>7. Regulatory STR Reporting (MAS SRF &amp; CAD STRO)</h4>
                <p class="summary-prose">{{ swarm.agents.reporting.executiveSummary }}</p>
              </div>
              <button type="button" class="dossier-btn" (click)="toggleDossier()">
                {{ dossierOpen() ? 'Hide CAD Dossier' : 'View CAD STRO Form 1 Dossier' }}
              </button>
            </div>

            @if (dossierOpen()) {
              <div class="dossier-wrapper">
                <div class="dossier-meta">
                  <span>REGULATION: MAS Notice 644 / SRF §4.2.5</span>
                  <span>CAD FORM 1 STATUTORY FILING READY FOR 1-CLICK SIGN-OFF</span>
                </div>
                <pre class="dossier">{{ swarm.agents.reporting.cadReportDossier }}</pre>
              </div>
            }
          </article>
        </div>
      } @else if (status() !== 'LOADING') {
        <!-- Standby Overview when report is not yet loaded -->
        <div class="standby-box">
          <div class="standby-header">
            <b>Autonomous Defense Mesh on Standby</b>
            <p>7 specialized Vertex AI agents stand ready to dissect ATO telemetry, counterparty risks, mule routing, and compile CAD STRO statutory reports.</p>
          </div>
          <button type="button" class="run-cta-btn" (click)="orchestrate.emit()">
            <span class="pulse-dot" aria-hidden="true"></span>
            <span>Dispatch 7-Agent Swarm Orchestrator</span>
          </button>
        </div>
      }
    </section>
  `,
  styles: `
    .card {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px 20px;
      border-radius: 14px;
      border: 1px solid var(--sentinel-color-border, #cbd5e1);
      background: var(--sentinel-surface-card, rgba(255, 255, 255, 0.98));
      backdrop-filter: blur(12px);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .title-line {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .spark {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: color-mix(in srgb, var(--sentinel-color-accent, #2563eb) 12%, transparent);
      color: var(--sentinel-color-accent, #2563eb);
    }
    .heading-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    h2 {
      margin: 0;
      font-size: 1.0625rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--sentinel-color-text, #0f172a);
    }
    .subtitle {
      margin: 2px 0 0;
      font-size: 0.75rem;
      color: var(--sentinel-color-text-secondary, #64748b);
    }
    .swarm-badge {
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 999px;
      background: #eff6ff;
      color: #2563eb;
      border: 1px solid #bfdbfe;
    }
    .orchestrate-btn,
    .run-cta-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 999px;
      background: var(--sentinel-color-accent, #2563eb);
      color: #fff;
      font-weight: 600;
      font-size: 0.8125rem;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);
    }
    .orchestrate-btn:hover:not(:disabled),
    .run-cta-btn:hover {
      background: #1d4ed8;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
    }
    .orchestrate-btn:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #4ade80;
      box-shadow: 0 0 8px #4ade80;
    }
    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Pipeline tracker */
    .pipeline-track {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 10px;
      background: color-mix(in srgb, var(--sentinel-color-background, #f8fafc) 65%, transparent);
      border: 1px solid var(--sentinel-color-border, #e2e8f0);
      overflow-x: auto;
    }
    .stage-node {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 130px;
    }
    .stage-num {
      font-size: 0.625rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      color: var(--sentinel-color-accent, #2563eb);
    }
    .stage-name {
      font-size: 0.8125rem;
      font-weight: 700;
      color: var(--sentinel-color-text, #0f172a);
    }
    .stage-model {
      font-size: 0.6875rem;
      color: var(--sentinel-color-text-secondary, #64748b);
    }
    .stage-arrow {
      color: var(--sentinel-color-text-secondary, #94a3b8);
      font-size: 0.875rem;
    }

    /* Threat banner */
    .threat-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      border-radius: 10px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
      font-size: 0.8125rem;
      flex-wrap: wrap;
      gap: 8px;
    }
    .threat-info {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .threat-pill {
      font-size: 0.6875rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      padding: 2px 8px;
      border-radius: 999px;
      background: #dc2626;
      color: #fff;
    }
    .threat-desc {
      font-weight: 600;
    }
    .threat-time {
      font-size: 0.75rem;
      color: #b91c1c;
    }

    /* Loading state */
    .loading-state {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px;
      border-radius: 10px;
      background: #eff6ff;
      color: #1e40af;
      font-size: 0.8125rem;
      font-weight: 500;
    }
    .loading-state .spinner {
      border-color: rgba(37, 99, 235, 0.2);
      border-top-color: #2563eb;
    }

    /* Agents grid */
    .agents-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px;
    }
    .agent-card {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 14px;
      border-radius: 10px;
      border: 1px solid var(--sentinel-color-border, #e2e8f0);
      background: color-mix(in srgb, var(--sentinel-color-surface, #fff) 80%, transparent);
      font-size: 0.75rem;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
    }
    .card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }
    .stage-tag {
      font-size: 0.5625rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      color: var(--sentinel-color-accent, #2563eb);
    }
    .model-tag {
      font-size: 0.625rem;
      color: var(--sentinel-color-text-secondary, #64748b);
      background: rgba(0, 0, 0, 0.04);
      padding: 1px 6px;
      border-radius: 4px;
    }
    .agent-card h4 {
      margin: 0;
      font-size: 0.875rem;
      font-weight: 700;
      color: var(--sentinel-color-text, #0f172a);
    }
    .agent-card p {
      margin: 0;
      color: var(--sentinel-color-text-secondary, #475569);
      line-height: 1.45;
      flex: 1;
    }
    .pill {
      align-self: flex-start;
      font-size: 0.625rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      padding: 3px 8px;
      border-radius: 6px;
      background: #f1f5f9;
      color: #334155;
    }
    .pill.danger {
      background: #fee2e2;
      color: #dc2626;
      border: 1px solid #fecaca;
    }
    .pill.warning {
      background: #fef3c7;
      color: #d97706;
      border: 1px solid #fde68a;
    }
    .agent-metric {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding-top: 6px;
      border-top: 1px solid var(--sentinel-color-border, #f1f5f9);
      font-size: 0.6875rem;
      color: var(--sentinel-color-text-secondary, #64748b);
    }
    .full-width {
      grid-column: 1 / -1;
    }
    .reporting-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .summary-prose {
      font-size: 0.8125rem !important;
      line-height: 1.5;
      margin-top: 4px !important;
    }
    .dossier-btn {
      padding: 6px 14px;
      border-radius: 8px;
      background: #0f172a;
      color: #fff;
      font-size: 0.75rem;
      font-weight: 600;
      border: none;
      cursor: pointer;
    }
    .dossier-wrapper {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 8px;
    }
    .dossier-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.625rem;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.04em;
    }
    pre.dossier {
      background: #090d16;
      color: #cbd5e1;
      padding: 12px 16px;
      border-radius: 8px;
      white-space: pre-wrap;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.71875rem;
      line-height: 1.45;
      margin: 0;
      max-height: 260px;
      overflow-y: auto;
    }
    .standby-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      border-radius: 10px;
      background: color-mix(in srgb, var(--sentinel-color-accent, #2563eb) 4%, transparent);
      border: 1px dashed var(--sentinel-color-border, #cbd5e1);
      flex-wrap: wrap;
      gap: 12px;
    }
    .standby-header b {
      font-size: 0.875rem;
      color: var(--sentinel-color-text, #0f172a);
    }
    .standby-header p {
      margin: 4px 0 0;
      font-size: 0.75rem;
      color: var(--sentinel-color-text-secondary, #64748b);
    }
  `,
})
export class AgentSwarmComponent {
  readonly report = input<SentinelSwarmReport | null>(null);
  readonly status = input<string>('IDLE');
  readonly orchestrate = output<void>();
  readonly dossierOpen = signal(false);

  toggleDossier(): void {
    this.dossierOpen.update((open) => !open);
  }
}
