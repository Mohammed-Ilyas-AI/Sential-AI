import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal, type OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SCENARIO_NOISE_MAX_RATE_PER_MINUTE } from '@sentinel/domain';
import { DemoControlsFacade } from '../../data-access/demo-controls-facade';

/**
 * Starts the synthetic DEMO_TAKEOVER_01 through sentinel-core (M§7 attack simulation mode). Disabled, with the
 * reason, where no launcher is configured. One run at a time; the run ID scopes everything it emits.
 */
@Component({
  selector: 'sentinel-scenario-launcher',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="note">Synthetic demo only: a scripted account takeover on synthetic accounts. No real bank or customer is involved.</p>
    @if (facade.capability(); as capability) {
      @if (!capability.available) {
        <p class="note">{{ capability.reason }}</p>
      }
      <label class="noise">
        <input type="checkbox" [checked]="noise()" (change)="noise.set($any($event.target).checked)" [disabled]="!capability.available" />
        Add seeded background noise ({{ rate() }}/min, seed {{ seed }})
      </label>
      @if (noise()) {
        <input type="range" min="1" [max]="maxRate" [value]="rate()" (input)="rate.set(+$any($event.target).value)" aria-label="Noise rate per minute" />
      }
      <button type="button" class="launch" [disabled]="!capability.available || facade.launching() || active()" (click)="launch()">
        {{ facade.launching() ? 'Launching…' : active() ? 'Run in progress' : 'Run DEMO_TAKEOVER_01' }}
      </button>
    } @else {
      <p class="note">Checking whether this deployment can launch scenarios…</p>
    }
    @if (facade.launchError(); as error) {
      <p class="error" role="alert">{{ error }}</p>
    }
    @if (facade.run(); as run) {
      <dl>
        <dt>Run</dt><dd class="mono">{{ run.runId }}</dd>
        <dt>Status</dt><dd [attr.data-status]="run.status">{{ run.status }}{{ run.failure ? ' · ' + run.failure : '' }}</dd>
        <dt>Requested</dt><dd>{{ run.requestedAt | date: 'd MMM, HH:mm:ss' : 'UTC' }} UTC by {{ run.requestedBy }}</dd>
        <dt>Evidence</dt><dd><a routerLink="/live-transactions" [queryParams]="{ q: run.runId }">Transactions of this run</a> · <a routerLink="/alerts">Alerts</a></dd>
      </dl>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 8px;
      font-size: var(--sentinel-font-size-caption);
    }
    .note {
      margin: 0;
      color: var(--sentinel-color-text-secondary);
    }
    .noise {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .launch {
      min-height: 34px;
      border: 0;
      border-radius: 9px;
      background: var(--sentinel-color-accent);
      color: var(--sentinel-color-on-accent, #fff);
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    .launch:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .error {
      margin: 0;
      color: var(--sentinel-color-critical);
    }
    dl {
      display: grid;
      grid-template-columns: 90px minmax(0, 1fr);
      gap: 4px 8px;
      margin: 0;
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
  `,
})
export class ScenarioLauncher implements OnInit {
  protected readonly facade = inject(DemoControlsFacade);
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

  protected launch(): void {
    this.facade.launch(this.noise() ? { seed: this.seed, ratePerMinute: this.rate() } : null);
  }
}
