import { LATENCY_BUDGETS_MS, type PerformanceSnapshot } from '@sentinel/domain';
import type { Clock } from '../../../platform/time/clock.js';

const WINDOW_MS = 5 * 60_000;
const MAX_SAMPLES = 10_000;
export const MEASURED_PATHS = ['decisionApi', 'securityEventIngest', 'transactionLifecycleIngest', 'graphQuery'] as const;
export type MeasuredPath = (typeof MEASURED_PATHS)[number];

interface Sample {
  readonly path: MeasuredPath;
  readonly at: number;
  readonly durationMs: number;
  readonly failed: boolean;
}

/**
 * T§10 budgets for the paths this instance can time. The decision API is the server half of "Pub/Sub publish to
 * decision"; the graph budget is for a cached two-hop query, and these graph reads are not cached.
 */
const BUDGETS: Partial<Record<MeasuredPath, { readonly target: number; readonly ceiling: number }>> = {
  decisionApi: LATENCY_BUDGETS_MS.pubSubPublishToDecision,
  graphQuery: LATENCY_BUDGETS_MS.graphTwoHopCachedQuery,
};

const quantile = (ordered: readonly number[], fraction: number): number | null =>
  ordered.length === 0 ? null : ordered[Math.max(0, Math.ceil(ordered.length * fraction) - 1)] ?? null;

/** A bounded, process-local request window. Labels are fixed route names and never contain request identifiers. */
export class PerformanceMetrics {
  private readonly samples: (Sample | undefined)[] = Array.from({ length: MAX_SAMPLES });
  private nextIndex = 0;
  private readonly instanceStartedAt: string;

  constructor(private readonly clock: Clock) {
    this.instanceStartedAt = clock.now().toISOString();
  }

  record(path: MeasuredPath, durationMs: number, statusCode: number): void {
    const at = this.clock.now().getTime();
    this.samples[this.nextIndex] = { path, at, durationMs: Math.max(0, durationMs), failed: statusCode >= 400 };
    this.nextIndex = (this.nextIndex + 1) % MAX_SAMPLES;
  }

  snapshot(): PerformanceSnapshot {
    const now = this.clock.now();
    const capturedAt = now.toISOString();
    const nowMs = now.getTime();
    const windowStartedMs = nowMs - WINDOW_MS;
    const windowSeconds = WINDOW_MS / 1000;
    const inWindow = this.samples.filter((sample): sample is Sample => sample !== undefined && sample.at >= windowStartedMs);
    return {
      windowSeconds,
      windowStartedAt: new Date(windowStartedMs).toISOString(),
      capturedAt,
      instanceStartedAt: this.instanceStartedAt,
      paths: MEASURED_PATHS.map((path) => {
        const records = inWindow.filter((sample) => sample.path === path);
        const durations = records.map((sample) => sample.durationMs).sort((left, right) => left - right);
        return {
          path,
          latency: {
            samples: durations.length,
            p50Ms: quantile(durations, 0.5),
            p95Ms: quantile(durations, 0.95),
            p99Ms: quantile(durations, 0.99),
            maxMs: durations.at(-1) ?? null,
          },
          requests: records.length,
          failures: records.filter((sample) => sample.failed).length,
          requestsPerSecond: windowSeconds > 0 ? records.length / windowSeconds : 0,
          ...(BUDGETS[path] ? { budget: { targetMs: BUDGETS[path].target, ceilingMs: BUDGETS[path].ceiling } } : {}),
        };
      }),
    };
  }

}

export function measuredPath(method: string, path: string): MeasuredPath | null {
  if (method === 'POST' && path === '/v1/decision/transactions') return 'decisionApi';
  if (method === 'POST' && path === '/v1/events/security') return 'securityEventIngest';
  if (method === 'POST' && path === '/internal/pubsub/transaction-events') return 'transactionLifecycleIngest';
  if (method === 'GET' && /^\/v1\/network\/[^/]+\/(?:neighbourhood|fund-trace)$/.test(path)) return 'graphQuery';
  return null;
}
