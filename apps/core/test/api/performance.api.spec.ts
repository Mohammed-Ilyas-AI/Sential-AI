import { describe, expect, it } from 'vitest';
import type { PerformanceSnapshot } from '@sentinel/domain';
import { startCoreHarness } from '../support/harness/core-test-harness.js';
import { callJson } from '../support/harness/http-bank-connector.js';
import { createInMemoryPersistence } from '../support/in-memory-repositories/in-memory-persistence.js';

describe('GET /v1/metrics/performance', () => {
  it('reports measured request counts and failures with safe route labels and null percentiles for empty paths', async () => {
    const harness = await startCoreHarness(createInMemoryPersistence(), { clockStart: '2026-09-24T11:30:00.000Z' });
    try {
      await callJson(harness.baseUrl, 'POST', '/v1/decision/transactions', {});
      const { status, body } = await callJson<PerformanceSnapshot>(harness.baseUrl, 'GET', '/v1/metrics/performance');
      expect(status).toBe(200);
      expect(body.windowSeconds).toBeGreaterThan(0);
      const decision = body.paths.find((path) => path.path === 'decisionApi');
      expect(decision).toMatchObject({ requests: 1, failures: 1, latency: { samples: 1 } });
      expect(body.paths.every((path) => !path.path.includes('acct_'))).toBe(true);
      expect(body.paths.find((path) => path.path === 'graphQuery')?.latency.p95Ms).toBeNull();
    } finally {
      await harness.close();
    }
  });
});
