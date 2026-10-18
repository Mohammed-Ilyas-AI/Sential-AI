import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import type { PerformanceSnapshot, ScenarioLaunchCapability, ScenarioRun } from '@sentinel/domain';
import { finalize } from 'rxjs';
import { CoreApiClient } from '../../../core/http/api-client/core-api-client';
import { PerformanceMetrics, type PerformanceSample } from '../../../core/telemetry/performance-metrics';
import { sessionFeature } from '../../../state/session/session.feature';

const PANEL_REFRESH_MS = 1_000;
const SERVER_REFRESH_MS = 5_000;
const RUN_POLL_MS = 3_000;

/**
 * Demo-only controls, always labelled as such: the live performance numbers and the synthetic scenario launcher.
 * The browser asks sentinel-core to start a run; it never holds a job name, command or credential.
 */
@Injectable({ providedIn: 'root' })
export class DemoControlsFacade {
  private readonly api = inject(CoreApiClient);
  private readonly metrics = inject(PerformanceMetrics);
  private readonly analyst = inject(Store).selectSignal(sessionFeature.selectAnalystIdentity);

  readonly ui = signal<PerformanceSample | null>(null);
  readonly server = signal<PerformanceSnapshot | null>(null);
  readonly serverStatus = signal<'IDLE' | 'READY' | 'UNAVAILABLE'>('IDLE');
  private panelTimers: ReturnType<typeof setInterval>[] = [];

  readonly capability = signal<ScenarioLaunchCapability | null>(null);
  readonly run = signal<ScenarioRun | null>(null);
  readonly launching = signal(false);
  readonly launchError = signal<string | null>(null);
  private runTimer: ReturnType<typeof setInterval> | null = null;
  private launchKey: string | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.stopPanel();
      this.stopRunPolling();
    });
  }

  /** Measures only while the panel is open. */
  startPanel(): void {
    this.stopPanel();
    const refreshUi = () => this.ui.set(this.metrics.sample());
    const refreshServer = () =>
      this.api.get<PerformanceSnapshot>('/v1/metrics/performance').subscribe({
        next: (snapshot) => {
          this.server.set(snapshot);
          this.serverStatus.set('READY');
        },
        error: () => this.serverStatus.set('UNAVAILABLE'),
      });
    refreshUi();
    refreshServer();
    this.panelTimers = [setInterval(refreshUi, PANEL_REFRESH_MS), setInterval(refreshServer, SERVER_REFRESH_MS)];
  }

  stopPanel(): void {
    for (const timer of this.panelTimers) clearInterval(timer);
    this.panelTimers = [];
  }

  loadLauncher(): void {
    this.api.get<ScenarioLaunchCapability>('/v1/demo/scenario-runs/capability').subscribe({
      next: (capability) => this.capability.set(capability),
      error: () => this.capability.set({ available: false, launcher: 'DISABLED', reason: 'sentinel-core is unreachable.' }),
    });
    this.api.get<{ runs: readonly ScenarioRun[] }>('/v1/demo/scenario-runs').subscribe({
      next: ({ runs }) => {
        const latest = runs[0] ?? null;
        this.run.set(latest);
        if (latest && (latest.status === 'LAUNCHING' || latest.status === 'RUNNING')) this.pollRun(latest.runId);
      },
      error: () => undefined,
    });
  }

  launch(noise: { readonly seed: number; readonly ratePerMinute: number } | null): void {
    if (this.launching()) return;
    this.launching.set(true);
    this.launchError.set(null);
    // The same click retried after a network failure carries the same key, so it cannot start a second run.
    this.launchKey ??= `launch-${crypto.randomUUID()}`;
    this.api
      .post<{ outcome: 'CREATED' | 'DUPLICATE'; record: ScenarioRun }>('/v1/demo/scenario-runs', {
        analystIdentity: this.analyst(),
        idempotencyKey: this.launchKey,
        noise,
      })
      .pipe(finalize(() => this.launching.set(false)))
      .subscribe({
        next: ({ record }) => {
          this.launchKey = null;
          this.run.set(record);
          this.pollRun(record.runId);
        },
        error: (error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status !== 0) this.launchKey = null;
          const detail = error instanceof HttpErrorResponse && typeof error.error === 'object' && error.error && 'detail' in error.error ? String(error.error.detail) : null;
          this.launchError.set(detail ?? 'The scenario could not be launched.');
        },
      });
  }

  private pollRun(runId: string): void {
    this.stopRunPolling();
    this.runTimer = setInterval(() => {
      this.api.get<ScenarioRun>(`/v1/demo/scenario-runs/${encodeURIComponent(runId)}`).subscribe({
        next: (run) => {
          this.run.set(run);
          if (run.status === 'COMPLETED' || run.status === 'FAILED') this.stopRunPolling();
        },
        error: () => undefined,
      });
    }, RUN_POLL_MS);
  }

  private stopRunPolling(): void {
    if (this.runTimer) clearInterval(this.runTimer);
    this.runTimer = null;
  }
}
