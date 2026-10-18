import { DEMO_TAKEOVER_01, SCENARIO_NOISE_MAX_RATE_PER_MINUTE } from '@sentinel/domain';
import { INSTANT_TIMELINE, buildDemoTakeover01, buildSeededNoiseScenario, newScenarioRunId, playScenario } from '@sentinel/scenarios';
import { describe, expect, it } from 'vitest';
import { startCoreHarness } from '../support/harness/core-test-harness.js';
import { HttpBankConnector } from '../support/harness/http-bank-connector.js';
import { createInMemoryPersistence } from '../support/in-memory-repositories/in-memory-persistence.js';

describe('seeded noise is isolated from the canonical takeover', () => {
  it('replays bounded background traffic without changing DEMO_TAKEOVER_01 expected scores or holds', async () => {
    const persistence = createInMemoryPersistence();
    const harness = await startCoreHarness(persistence, { clockStart: '2026-09-24T11:30:00.000Z' });
    try {
      const connector = new HttpBankConnector(harness.baseUrl, harness.clock);
      const canonical = await playScenario(
        buildDemoTakeover01('2026-09-24T11:30:00.000Z', { runId: 'CANON1' }),
        connector,
        INSTANT_TIMELINE,
      );
      expect(canonical.transfers.filter((item) => item.response.decision === 'HOLD').map((item) => item.response.riskScore)).toEqual([DEMO_TAKEOVER_01.finalScore]);

      const noise = buildSeededNoiseScenario('2026-09-24T11:30:00.000Z', 20260924, newScenarioRunId(Date.parse('2026-09-24T11:30:01.000Z')), 4);
      const noiseReport = await playScenario(noise, connector, INSTANT_TIMELINE);
      expect(noiseReport.transfers).toHaveLength(4);
      expect(noiseReport.transfers.every((item) => item.response.decision !== 'HOLD')).toBe(true);
      expect(noiseReport.transfers.every((item) => item.response.riskScore >= 40 && item.response.riskScore < 65)).toBe(true);

      const canonicalReplay = await playScenario(
        buildDemoTakeover01('2026-09-24T11:30:00.000Z', { runId: 'CANON1' }),
        connector,
        INSTANT_TIMELINE,
      );
      expect(canonicalReplay.transfers.map((item) => [item.response.riskScore, item.response.decision])).toEqual(
        canonical.transfers.map((item) => [item.response.riskScore, item.response.decision]),
      );
      expect(canonical.transfers.find((item) => item.response.decision === 'HOLD')?.response.riskScore).toBe(DEMO_TAKEOVER_01.finalScore);
    } finally {
      await harness.close();
    }
  });

  it('stays ELEVATED and below the gate at the maximum rate, with no alert above ELEVATED', async () => {
    const persistence = createInMemoryPersistence();
    const harness = await startCoreHarness(persistence, { clockStart: '2026-09-24T11:30:00.000Z' });
    try {
      const noise = buildSeededNoiseScenario('2026-09-24T11:30:00.000Z', 7, 'NOISEMAX', SCENARIO_NOISE_MAX_RATE_PER_MINUTE);
      const report = await playScenario(noise, new HttpBankConnector(harness.baseUrl, harness.clock), INSTANT_TIMELINE);
      expect(report.transfers).toHaveLength(SCENARIO_NOISE_MAX_RATE_PER_MINUTE);
      expect(report.transfers.every((item) => item.response.decision === 'ALLOW')).toBe(true);
      expect(report.transfers.every((item) => item.response.riskScore >= 40 && item.response.riskScore < 65)).toBe(true);
      expect(persistence.alertStore.all().every((alert) => alert.band === 'ELEVATED' || alert.band === 'LOW')).toBe(true);
    } finally {
      await harness.close();
    }
  });
});
