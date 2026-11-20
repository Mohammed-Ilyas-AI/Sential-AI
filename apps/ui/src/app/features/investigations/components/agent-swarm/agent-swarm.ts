import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { SentinelSwarmReport } from '@sentinel/domain';
import { Icon } from '../../../../shared/ui/icon/icon';

@Component({
  selector: 'sentinel-agent-swarm',
  imports: [DatePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="swarm-title">
      <header>
        <span class="title-line">
          <span class="spark" aria-hidden="true"><sentinel-icon name="radar" [size]="18" /></span>
          <h2 id="swarm-title">Sentinel 7-Agent Swarm Orchestrator</h2>
          <span class="swarm-badge">Autonomous Defense Mesh</span>
        </span>
        <button
          type="button"
          class="orchestrate-btn"
          (click)="orchestrate.emit()"
          [disabled]="status() === 'LOADING'"
        >
          {{ status() === 'LOADING' ? 'Orchestrating 7 Agents…' : 'Orchestrate Swarm' }}
        </button>
      </header>

      @if (status() === 'LOADING') {
        <div class="loading-state" role="status" aria-live="polite">
          <span class="spinner" aria-hidden="true"></span>
          <span>Running parallel triaging, verification challenge and regulatory synthesis…</span>
        </div>
      }

      @if (report(); as swarm) {
        <div class="threat-banner" [attr.data-threat]="swarm.overallThreatLevel">
          <b>Overall Threat Level: {{ swarm.overallThreatLevel }}</b>
          <span>Evaluated at {{ swarm.evaluatedAt | date: 'HH:mm:ss' }}</span>
        </div>

        <div class="agents-grid">
          <article class="agent-card">
            <h4>1. ATO Investigation</h4>
            <span class="pill" [attr.data-risk]="swarm.agents.ato.deviceRisk">{{ swarm.agents.ato.deviceRisk }}</span>
            <p>{{ swarm.agents.ato.authenticationLineage }}</p>
            <small>ATO Confidence: {{ swarm.agents.ato.atoConfidenceScore }}%</small>
          </article>

          <article class="agent-card">
            <h4>2. Beneficiary Intel</h4>
            <span class="pill" [attr.data-risk]="swarm.agents.beneficiary.payeeRiskTier">{{ swarm.agents.beneficiary.payeeRiskTier }}</span>
            <p>{{ swarm.agents.beneficiary.counterpartyAssessment }}</p>
          </article>

          <article class="agent-card">
            <h4>3. Scam Intent</h4>
            <span class="pill" [attr.data-coercion]="swarm.agents.scamIntent.coercionIndex">{{ swarm.agents.scamIntent.coercionIndex }}</span>
            <p>{{ swarm.agents.scamIntent.behavioralAnomalySummary }}</p>
          </article>

          <article class="agent-card">
            <h4>4. Mule Tracing</h4>
            <span class="pill" [attr.data-mule]="swarm.agents.muleTrace.identifiedMuleRing">{{ swarm.agents.muleTrace.identifiedMuleRing ? 'MULE RING' : 'CLEAR' }}</span>
            <p>Observed Hops: {{ swarm.agents.muleTrace.observedHops }} ({{ swarm.agents.muleTrace.observabilityStopReason }})</p>
          </article>

          <article class="agent-card">
            <h4>5. Customer Verify</h4>
            <span class="pill" [attr.data-call]="swarm.agents.verification.callOutcome">{{ swarm.agents.verification.callOutcome }}</span>
            <p>{{ swarm.agents.verification.verificationScript }}</p>
          </article>

          <article class="agent-card">
            <h4>6. Recovery & Recall</h4>
            <span class="pill" [attr.data-kill]="swarm.agents.recovery.killSwitchEngaged">{{ swarm.agents.recovery.killSwitchEngaged ? 'KILL SWITCH ENGAGED' : 'MONITORING' }}</span>
            <p>Interbank Recall: {{ swarm.agents.recovery.interbankRecallStatus }}</p>
          </article>

          <article class="agent-card full-width">
            <h4>7. Regulatory STR Reporting (MAS / CAD STRO)</h4>
            <span class="pill pass">CAD FORM 1 READY</span>
            <p class="summary-prose">{{ swarm.agents.reporting.executiveSummary }}</p>
            <pre class="dossier">{{ swarm.agents.reporting.cadReportDossier }}</pre>
          </article>
        </div>
      }
    </section>
  `,
  styles: `
    .card {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      border-radius: 12px;
      border: 1px solid var(--sentinel-color-border, #e2e8f0);
      background: var(--sentinel-surface-card, rgba(255, 255, 255, 0.95));
      backdrop-filter: blur(8px);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .title-line {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    h2 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
    }
    .swarm-badge {
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 2px 8px;
      border-radius: 999px;
      background: #eff6ff;
      color: #2563eb;
    }
    .orchestrate-btn {
      padding: 6px 14px;
      border-radius: 8px;
      background: #2563eb;
      color: #fff;
      font-weight: 600;
      font-size: 0.8125rem;
      border: none;
      cursor: pointer;
    }
    .orchestrate-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .threat-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      border-radius: 8px;
      background: #fef2f2;
      color: #991b1b;
      font-size: 0.8125rem;
    }
    .agents-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 10px;
    }
    .agent-card {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      background: rgba(248, 250, 252, 0.8);
      font-size: 0.75rem;
    }
    .agent-card h4 {
      margin: 0;
      font-size: 0.8125rem;
      font-weight: 600;
    }
    .pill {
      align-self: flex-start;
      font-size: 0.625rem;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 6px;
      background: #e2e8f0;
    }
    .pill[data-risk='UNSEEN_COMPROMISED'],
    .pill[data-coercion='ACUTE_COERCION'],
    .pill[data-kill='true'] {
      background: #fee2e2;
      color: #dc2626;
    }
    .full-width {
      grid-column: 1 / -1;
    }
    pre.dossier {
      background: #0f172a;
      color: #e2e8f0;
      padding: 8px;
      border-radius: 6px;
      white-space: pre-wrap;
      font-family: monospace;
      font-size: 0.7rem;
      margin: 0;
    }
  `,
})
export class AgentSwarmComponent {
  readonly report = input<SentinelSwarmReport | null>(null);
  readonly status = input<string>('IDLE');
  readonly orchestrate = output<void>();
}
