import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal, type OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SCENARIO_NOISE_MAX_RATE_PER_MINUTE } from '@sentinel/domain';
import { DemoControlsFacade } from '../../data-access/demo-controls-facade';
import { LiveDemoAutopilot } from '../../data-access/live-demo-autopilot';

export type LaunchableScenarioId = 'DEMO_TAKEOVER_01' | 'MULTI_SCAM_BURST_01';

export interface AttackScenarioMeta {
  readonly id: LaunchableScenarioId;
  readonly name: string;
  readonly badge: string;
  readonly targetAccount: string;
  readonly vector: string;
  readonly expectedGate: string;
  readonly description: string;
}

/** The scenarios this deployment can actually play, as the code plays them. Synthetic accounts only. */
export const SCENARIO_CATALOG: readonly AttackScenarioMeta[] = [
  {
    id: 'DEMO_TAKEOVER_01',
    name: 'Account takeover & rapid drain',
    badge: 'TAKEOVER',
    targetAccount: 'A fresh synthetic account at Bank A each run · S$52,000 opening balance',
    vector: 'Login from unseen device DEV-7f3a · three new payees · four transfers in about five seconds.',
    expectedGate: 'SG-RD-50: the fourth transfer takes the 24-hour drain to 65.4%, past 50%, and is held.',
    description: 'The guided live demo: the hold, the 7-agent swarm, an automated call, an analyst-approved kill switch, Gemini-drafted voicemail and email, and the attacker blocked.',
  },
  {
    id: 'MULTI_SCAM_BURST_01',
    name: 'Multi-scam burst',
    badge: '12 CASES · 3 BANKS',
    targetAccount: 'Twelve synthetic accounts across Bank A, Bank B and Bank C',
    vector: "The reference's four patterns at once: phishing takeover, mule account, smurfing, credential replay.",
    expectedGate: 'SG-RD-50 holds what passes 50% on a protected account; everything else is scored and alerted.',
    description: 'Twelve cases decided in parallel by the rules; seven agents work every held or high-risk case; the analyst approves the kill switches they recommend.',
  },
];

@Component({
  selector: 'sentinel-scenario-launcher',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="launcher-box">
      <div class="header-row">
        <div>
          <span class="badge">ATTACK SIMULATION SUITE</span>
          <h3>Live Scenario Generator</h3>
        </div>
        <span class="demo-tag">Synthetic Bank Data</span>
      </div>

      <div class="field">
        <label for="scenarioSelect">Select Attack Scenario</label>
        <select id="scenarioSelect" [value]="selectedScenarioId()" (change)="selectScenario($any($event.target).value)">
          @for (item of catalog; track item.id) {
            <option [value]="item.id">{{ item.name }} ({{ item.badge }})</option>
          }
        </select>
      </div>

      @if (currentScenario(); as sc) {
        <div class="scenario-card">
          <div class="card-head">
            <b>{{ sc.name }}</b>
            <span class="sc-badge">{{ sc.badge }}</span>
          </div>
          <p class="desc">{{ sc.description }}</p>
          <div class="details-grid">
            <span class="k">Target:</span><span class="v">{{ sc.targetAccount }}</span>
            <span class="k">Vector:</span><span class="v">{{ sc.vector }}</span>
            <span class="k">Gate:</span><span class="v text-accent">{{ sc.expectedGate }}</span>
          </div>
        </div>
      }

      <label class="noise">
        <input type="checkbox" [checked]="noise()" (change)="noise.set($any($event.target).checked)" />
        Add background noise ({{ rate() }}/min, seed {{ seed }})
      </label>
      @if (noise()) {
        <input type="range" min="1" [max]="maxRate" [value]="rate()" (input)="rate.set(+$any($event.target).value)" aria-label="Noise rate per minute" />
      }

      <div class="actions">
        <button type="button" class="launch" [disabled]="facade.launching() || active() || liveDemo.running()" (click)="launchScenario()">
          {{ facade.launching() ? 'Launching simulation…' : active() || liveDemo.running() ? 'Attack in progress…' : '▶ Launch ' + currentScenario()?.name }}
        </button>
      </div>

      @if (facade.launchError(); as error) {
        <p class="error" role="alert">{{ error }}</p>
      }

      @if (facade.run(); as run) {
        <dl>
          <dt>Run ID</dt><dd class="mono">{{ run.runId }}</dd>
          <dt>Status</dt><dd [attr.data-status]="run.status">{{ run.status }}{{ run.failure ? ' · ' + run.failure : '' }}</dd>
          <dt>Requested</dt><dd>{{ run.requestedAt | date: 'd MMM, HH:mm:ss' : 'UTC' }} UTC</dd>
          <dt>Shortcuts</dt>
          <dd class="links">
            <a routerLink="/live-transactions" [queryParams]="{ q: run.runId }">Inspect Inflow</a> · 
            <a routerLink="/network-analysis" [queryParams]="{ trace: 'true' }">View Trace</a> · 
            <a routerLink="/alerts">Alerts</a>
          </dd>
        </dl>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      font-size: var(--sentinel-font-size-caption);
    }
    .launcher-box {
      display: grid;
      gap: 10px;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    h3 {
      margin: 2px 0 0;
      font-size: 0.9375rem;
      font-weight: 700;
      color: var(--sentinel-color-text);
    }
    .badge {
      font-size: 0.625rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--sentinel-color-accent);
      text-transform: uppercase;
    }
    .demo-tag {
      font-size: 0.6875rem;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.06);
      color: var(--sentinel-color-text-secondary);
    }
    .field {
      display: grid;
      gap: 4px;
    }
    label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--sentinel-color-text-secondary);
    }
    select {
      width: 100%;
      height: 36px;
      padding: 0 10px;
      border: 1px solid var(--sentinel-surface-panel-border);
      border-radius: 8px;
      background: var(--sentinel-color-surface);
      color: var(--sentinel-color-text);
      font: inherit;
      font-size: 0.8125rem;
      outline: none;
    }
    select:focus {
      border-color: var(--sentinel-color-accent);
    }
    .scenario-card {
      padding: 10px 12px;
      border: 1px solid var(--sentinel-surface-panel-border);
      border-radius: 10px;
      background: color-mix(in srgb, var(--sentinel-color-surface) 90%, transparent);
      display: grid;
      gap: 6px;
    }
    .card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.8125rem;
      color: #fff;
    }
    .sc-badge {
      font-size: 0.625rem;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(54, 185, 231, 0.15);
      color: var(--sentinel-color-accent);
      border: 1px solid rgba(54, 185, 231, 0.3);
    }
    .desc {
      margin: 0;
      font-size: 0.75rem;
      color: var(--sentinel-color-text-secondary);
      line-height: 1.35;
    }
    .details-grid {
      display: grid;
      grid-template-columns: 55px minmax(0, 1fr);
      gap: 3px 6px;
      font-size: 0.6875rem;
      margin-top: 4px;
      padding-top: 6px;
      border-top: 1px solid var(--sentinel-surface-panel-border);
    }
    .k {
      color: var(--sentinel-color-text-secondary);
      font-weight: 600;
    }
    .v {
      color: var(--sentinel-color-text);
    }
    .text-accent {
      color: var(--sentinel-color-accent);
      font-weight: 600;
    }
    .noise {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.75rem;
      cursor: pointer;
    }
    .launch {
      width: 100%;
      min-height: 38px;
      border: 0;
      border-radius: 10px;
      background: var(--sentinel-color-accent);
      color: var(--sentinel-color-on-accent, #fff);
      font: inherit;
      font-weight: 700;
      font-size: 0.8125rem;
      cursor: pointer;
      box-shadow: 0 4px 14px color-mix(in srgb, var(--sentinel-color-accent) 35%, transparent);
      transition: all 0.2s ease;
    }
    .launch:hover:not(:disabled) {
      filter: brightness(1.1);
      box-shadow: 0 0 16px var(--sentinel-color-accent);
    }
    .launch:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .error {
      margin: 0;
      color: var(--sentinel-color-critical);
      font-size: 0.75rem;
    }
    dl {
      display: grid;
      grid-template-columns: 80px minmax(0, 1fr);
      gap: 4px 8px;
      margin: 4px 0 0;
      padding: 8px 10px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.2);
    }
    dt {
      color: var(--sentinel-color-text-secondary);
    }
    dd {
      margin: 0;
    }
    [data-status='COMPLETED'] {
      color: var(--sentinel-color-success);
    }
    [data-status='FAILED'] {
      color: var(--sentinel-color-critical);
    }
    .mono {
      font-family: var(--sentinel-font-family-mono);
    }
    .links a {
      color: var(--sentinel-color-accent);
      text-decoration: underline;
    }
  `,
})
export class ScenarioLauncher implements OnInit {
  protected readonly facade = inject(DemoControlsFacade);
  protected readonly liveDemo = inject(LiveDemoAutopilot);
  private readonly router = inject(Router);

  protected readonly catalog = SCENARIO_CATALOG;
  protected readonly selectedScenarioId = signal<LaunchableScenarioId>('DEMO_TAKEOVER_01');
  protected readonly currentScenario = computed(() => 
    this.catalog.find((sc) => sc.id === this.selectedScenarioId()) ?? this.catalog[0]
  );

  protected readonly noise = signal(false);
  protected readonly rate = signal(4);
  protected readonly seed = 20260924;
  protected readonly maxRate = SCENARIO_NOISE_MAX_RATE_PER_MINUTE;

  protected active(): boolean {
    const status = this.facade.run()?.status;
    return status === 'LAUNCHING' || status === 'RUNNING';
  }

  ngOnInit(): void {
    this.facade.loadLauncher();
  }

  protected selectScenario(id: string): void {
    const found = this.catalog.find((item) => item.id === id);
    if (found) this.selectedScenarioId.set(found.id);
  }

  /** The burst always plays in-process. The takeover uses the configured launcher when there is one, else the tour. */
  protected launchScenario(): void {
    if (this.selectedScenarioId() === 'MULTI_SCAM_BURST_01') {
      void this.liveDemo.startBurst();
      return;
    }
    const capability = this.facade.capability();
    if (capability && capability.available) {
      this.facade.launch(this.noise() ? { seed: this.seed, ratePerMinute: this.rate() } : null);
    } else {
      void this.liveDemo.start();
      void this.router.navigateByUrl('/control-tower');
    }
  }
}
