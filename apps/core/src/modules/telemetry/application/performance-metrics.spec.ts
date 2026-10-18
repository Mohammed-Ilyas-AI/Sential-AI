import { describe, expect, it } from 'vitest';
import { PerformanceMetrics, measuredPath } from './performance-metrics.js';

class TestClock {
  private current: number;

  constructor(start: string) {
    this.current = Date.parse(start);
  }

  now(): Date {
    return new Date(this.current);
  }

  advanceBy(milliseconds: number): void {
    this.current += milliseconds;
  }
}

describe('PerformanceMetrics', () => {
  it('returns null latency percentiles without samples and measures a bounded real-request window', () => {
    const clock = new TestClock('2026-09-24T11:30:00.000Z');
    const metrics = new PerformanceMetrics(clock);
    expect(metrics.snapshot().paths.find((path) => path.path === 'decisionApi')?.latency).toMatchObject({
      samples: 0,
      p50Ms: null,
      p95Ms: null,
      p99Ms: null,
      maxMs: null,
    });

    metrics.record('decisionApi', 10, 200);
    metrics.record('decisionApi', 40, 500);
    clock.advanceBy(1_000);
    const snapshot = metrics.snapshot();
    expect(snapshot.paths.find((path) => path.path === 'decisionApi')).toMatchObject({
      requests: 2,
      failures: 1,
      latency: { samples: 2, p50Ms: 10, p95Ms: 40, p99Ms: 40, maxMs: 40 },
    });
    expect(snapshot.windowSeconds).toBe(300);

    clock.advanceBy(5 * 60_000);
    expect(metrics.snapshot().paths.find((path) => path.path === 'decisionApi')?.latency.samples).toBe(0);
  });

  it('maps only allowlisted route names and never includes an identifier in a metric label', () => {
    expect(measuredPath('POST', '/v1/decision/transactions')).toBe('decisionApi');
    expect(measuredPath('GET', '/v1/network/acct_sensitive/neighbourhood')).toBe('graphQuery');
    expect(measuredPath('GET', '/v1/accounts/acct_sensitive')).toBeNull();
  });
});
