import { DEMO_TAKEOVER_01, type LiveDemoReport } from '@sentinel/domain';
import { afterEach, describe, expect, it } from 'vitest';
import { startCoreHarness, type CoreHarness } from '../support/harness/core-test-harness.js';
import { callJson } from '../support/harness/http-bank-connector.js';
import { createInMemoryPersistence } from '../support/in-memory-repositories/in-memory-persistence.js';

describe('/v1/demo/live-demo — DEMO_TAKEOVER_01 through the control path, in-process', () => {
  let harness: CoreHarness;
  afterEach(() => harness.close());

  it('plays the synthetic takeover through the real gate and reports the transfer it held', async () => {
    const persistence = createInMemoryPersistence();
    harness = await startCoreHarness(persistence, { clockStart: '2026-09-24T11:30:00.000Z' });

    const response = await callJson<LiveDemoReport>(harness.baseUrl, 'POST', '/v1/demo/live-demo', { analystIdentity: 'analyst.tan' });
    expect(response.status).toBe(200);
    expect(response.body.scenarioId).toBe('DEMO_TAKEOVER_01');
    expect(response.body.transfers).toBeGreaterThan(4);
    const final = DEMO_TAKEOVER_01.steps.at(-1);
    expect(response.body.held).toHaveLength(1);
    expect(response.body.held[0]).toMatchObject({ amount: final && 'amount' in final ? final.amount : -1, riskScore: 95 });
    const audit = await callJson<{ events: { action: string }[] }>(harness.baseUrl, 'GET', '/v1/audit-events?limit=10');
    expect(audit.body.events.map((event) => event.action)).toContain('LIVE_DEMO_STARTED');
  });

  it('needs an analyst identity', async () => {
    harness = await startCoreHarness(createInMemoryPersistence());
    expect((await callJson(harness.baseUrl, 'POST', '/v1/demo/live-demo', {})).status).toBe(400);
  });
});
