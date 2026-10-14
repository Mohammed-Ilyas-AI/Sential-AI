import { DEMO_TAKEOVER_01 } from '@sentinel/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startCoreHarness, type CoreHarness } from '../support/harness/core-test-harness.js';
import { createInMemoryPersistence } from '../support/in-memory-repositories/in-memory-persistence.js';
import {
  DOCUMENTED_SCORES,
  FIRST_EPOCH,
  outflowInWindow,
  playTwoRunsAndAReplay,
  scriptedTransfers,
  victimOf,
  type RepeatRunsResult,
} from '../support/scenario/repeat-runs.js';

describe('DEMO_TAKEOVER_01 run twice into the same store', () => {
  const persistence = createInMemoryPersistence();
  let harness: CoreHarness;
  let result: RepeatRunsResult;

  beforeAll(async () => {
    harness = await startCoreHarness(persistence, { clockStart: FIRST_EPOCH });
    result = await playTwoRunsAndAReplay(harness);
  });
  afterAll(() => harness.close());

  it('scores both runs 37, 49, 75 and 95 with exactly one HOLD each', () => {
    for (const [report, runId] of [[result.first, 'RUNA'], [result.second, 'RUNB']] as const) {
      const transfers = scriptedTransfers(report, runId);
      expect(transfers.map((transfer) => transfer.response.riskScore)).toEqual(DOCUMENTED_SCORES);
      expect(transfers.map((transfer) => transfer.response.decision)).toEqual(['ALLOW', 'ALLOW', 'ALLOW', 'HOLD']);
      expect(transfers.at(-1)?.response.reasonCodes).toEqual(['SG-RD-50_THRESHOLD_EXCEEDED']);
    }
  });

  it('keeps the runs apart: the second run is new activity on its own accounts, not a replay or a cascade', () => {
    const firstIds = new Set(result.first.transfers.map((transfer) => transfer.response.decisionId));
    expect(result.second.transfers.every((transfer) => !firstIds.has(transfer.response.decisionId))).toBe(true);
    expect(victimOf('RUNA')).not.toBe(victimOf('RUNB'));
  });

  it('counts each run’s S$34,000 exactly once, never doubled by the other run or the replay', async () => {
    expect(await outflowInWindow(persistence, result.first, 'RUNA')).toBe(DEMO_TAKEOVER_01.totalMovedInWindow);
    expect(await outflowInWindow(persistence, result.second, 'RUNB')).toBe(DEMO_TAKEOVER_01.totalMovedInWindow);
  });

  it('answers the exact replay of run one from the stored decisions: no new decision, hold or alert', async () => {
    expect(result.replay.transfers.map((transfer) => transfer.response.decisionId)).toEqual(result.first.transfers.map((transfer) => transfer.response.decisionId));
    expect(result.replay.transfers.map((transfer) => transfer.response.riskScore)).toEqual(result.first.transfers.map((transfer) => transfer.response.riskScore));
    for (const runId of ['RUNA', 'RUNB']) {
      const interventions = await persistence.interventions.findByAccountId(victimOf(runId));
      expect(interventions.map((intervention) => `${intervention.state}:${intervention.actor}`)).toEqual(['HELD:SYSTEM']);
    }
    const alerts = persistence.alertStore.all().filter((alert) => alert.accountReference === DEMO_TAKEOVER_01.accountDisplayId);
    expect(alerts.map((alert) => [alert.band, alert.score, alert.onHold])).toEqual([
      ['CRITICAL', 95, true],
      ['CRITICAL', 95, true],
    ]);
  });

  it('records each run’s security events once: the replayed posture scores match and nothing is re-applied', () => {
    expect(result.replay.securityReceipts.map((receipt) => receipt.outcome)).toEqual(result.replay.securityReceipts.map(() => 'DUPLICATE'));
    expect(result.second.securityReceipts.slice(0, 2).map((receipt) => receipt.posture.score)).toEqual([21, 37]);
  });
});
