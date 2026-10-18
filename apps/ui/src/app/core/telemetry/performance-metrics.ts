import { EnvironmentInjector, Injectable, afterEveryRender, inject } from '@angular/core';

/** T§5 targets, measured in this browser: sustained rate, main-thread time per batch, message to row, render passes. */
export const UI_PERFORMANCE_TARGETS = {
  eventsPerSecond: 50,
  mainThreadMsPerBatch: 8,
  messageToRowMs: 300,
  changeDetectionPassesPerSecond: 4,
} as const;

const WINDOW_MS = 10_000;
const MAX_SAMPLES = 2_000;

interface Sample {
  readonly at: number;
  readonly value: number;
}

/** A bounded ring of timestamped samples; reading never allocates more than MAX_SAMPLES. */
class Ring {
  private readonly samples: (Sample | undefined)[] = Array.from({ length: MAX_SAMPLES });
  private next = 0;

  push(value: number, at: number): void {
    this.samples[this.next] = { at, value };
    this.next = (this.next + 1) % MAX_SAMPLES;
  }

  since(from: number): readonly Sample[] {
    return this.samples.filter((sample): sample is Sample => sample !== undefined && sample.at >= from);
  }
}

export interface MeasuredValue {
  readonly samples: number;
  /** Null when nothing was measured in the window: never reported as zero. */
  readonly p50: number | null;
  readonly p95: number | null;
}

/** The live numbers behind the performance panel (T§5): measured, not asserted, over the last ten seconds. */
export interface PerformanceSample {
  readonly windowSeconds: number;
  readonly eventsPerSecond: number;
  readonly mainThreadMsPerBatch: MeasuredValue;
  readonly messageToRowMs: MeasuredValue;
  readonly changeDetectionPassesPerSecond: number;
  readonly capturedAt: number;
}

const quantile = (ordered: readonly number[], fraction: number): number | null =>
  ordered.length === 0 ? null : (ordered[Math.max(0, Math.ceil(ordered.length * fraction) - 1)] ?? null);

const measured = (samples: readonly Sample[]): MeasuredValue => {
  const ordered = samples.map((sample) => sample.value).sort((left, right) => left - right);
  return { samples: ordered.length, p50: quantile(ordered, 0.5), p95: quantile(ordered, 0.95) };
};

/**
 * Browser-side measurements, recorded by the stream pipeline and Angular's render hook. Recording is a ring-buffer
 * write and never blocks or alters the stream; nothing here reaches the store or the server.
 */
@Injectable({ providedIn: 'root' })
export class PerformanceMetrics {
  private readonly events = new Ring();
  private readonly batches = new Ring();
  private readonly latencies = new Ring();
  private readonly renders = new Ring();
  private renderHookInstalled = false;
  private readonly injector = inject(EnvironmentInjector);

  /** Counts render passes from the first time the panel asks; until then nothing is hooked. */
  private ensureRenderHook(): void {
    if (this.renderHookInstalled) return;
    this.renderHookInstalled = true;
    afterEveryRender(() => this.renders.push(1, performance.now()), { injector: this.injector });
  }

  recordDecisions(count: number): void {
    if (count > 0) this.events.push(count, performance.now());
  }

  recordBatch(mainThreadMs: number): void {
    this.batches.push(Math.max(0, mainThreadMs), performance.now());
  }

  /**
   * From the oldest message in a batch arriving to the first frame painted after the store took the batch. A hidden
   * page paints nothing, so nothing is recorded then: a frame that runs late because the tab was in the background
   * would otherwise report the background time as latency.
   */
  recordMessageToRow(receivedAt: number): void {
    if (document.visibilityState !== 'visible') return;
    requestAnimationFrame(() => {
      if (document.visibilityState === 'visible') this.latencies.push(Math.max(0, performance.now() - receivedAt), performance.now());
    });
  }

  sample(): PerformanceSample {
    this.ensureRenderHook();
    const now = performance.now();
    const from = now - WINDOW_MS;
    const seconds = WINDOW_MS / 1000;
    return {
      windowSeconds: seconds,
      eventsPerSecond: this.events.since(from).reduce((total, sample) => total + sample.value, 0) / seconds,
      mainThreadMsPerBatch: measured(this.batches.since(from)),
      messageToRowMs: measured(this.latencies.since(from)),
      changeDetectionPassesPerSecond: this.renders.since(from).length / seconds,
      capturedAt: Date.now(),
    };
  }
}
