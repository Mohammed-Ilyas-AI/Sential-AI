import type { IsoTimestamp } from '../time/iso-timestamp.js';

/** Distribution of recorded durations in one window. Null percentiles mean no samples, never zero latency. */
export interface LatencyDistribution {
  readonly samples: number;
  readonly p50Ms: number | null;
  readonly p95Ms: number | null;
  readonly p99Ms: number | null;
  readonly maxMs: number | null;
}

export interface MeasuredPath {
  /** For example `decisionApi`; never an account, token or other identifier. */
  readonly path: string;
  readonly latency: LatencyDistribution;
  readonly requests: number;
  readonly failures: number;
  readonly requestsPerSecond: number;
  /** From LATENCY_BUDGETS_MS when the Technical Document defines one for this path. */
  readonly budget?: { readonly targetMs: number; readonly ceilingMs: number };
}

/** GET /v1/metrics/performance — measured on this instance, in a bounded window, from real requests. */
export interface PerformanceSnapshot {
  readonly windowSeconds: number;
  readonly windowStartedAt: IsoTimestamp;
  readonly capturedAt: IsoTimestamp;
  readonly instanceStartedAt: IsoTimestamp;
  readonly paths: readonly MeasuredPath[];
}
