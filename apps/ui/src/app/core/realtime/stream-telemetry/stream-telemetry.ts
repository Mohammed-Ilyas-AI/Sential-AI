import { Injectable, signal } from '@angular/core';

/** Frames arriving later than this after emission are clamped: they reflect clock skew, not the network. */
const MAX_PLAUSIBLE_LATENCY_MS = 60_000;

/**
 * Measured, not asserted: the delay between sentinel-stream emitting a frame and this browser receiving it.
 * Kept in a signal, not the store, so a heartbeat never triggers an action.
 */
@Injectable({ providedIn: 'root' })
export class StreamTelemetry {
  private readonly latency = signal<number | null>(null);
  readonly frameLatencyMs = this.latency.asReadonly();

  record(emittedAt: string, receivedAt: number = Date.now()): void {
    const emitted = Date.parse(emittedAt);
    if (Number.isNaN(emitted)) return;
    const delay = receivedAt - emitted;
    if (delay < MAX_PLAUSIBLE_LATENCY_MS) this.latency.set(Math.max(0, Math.round(delay)));
  }
}
