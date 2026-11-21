import { runAccountReference, type MultiScamBurstCase, type MultiScamBurstReport } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import type { TapeRow } from '../../../workers/transaction-worker-protocol';
import { buildBurstBoard } from './burst-board';

const SINCE = Date.parse('2026-11-21T05:00:00.000Z');

function row(reference: string, overrides: Partial<TapeRow> = {}): TapeRow {
  return {
    transactionId: `txn-${reference}-${overrides.score ?? 0}`,
    accountId: `acct_tok_${reference}`,
    accountReference: reference,
    institutionId: 'BANK_A',
    destinationInstitutionId: 'BANK_B',
    amount: 100_000,
    score: 40,
    band: 'ELEVATED',
    decision: 'ALLOW',
    occurredAt: '2026-11-21T05:00:02.000Z',
    decidedAt: '2026-11-21T05:00:02.000Z',
    assessmentId: 'asmt',
    reasonCodes: [],
    policyVersion: 'SG-RD-1.0',
    rulesetVersion: 'r1',
    drain: { balanceAtWindowStart: 5_200_000, outflow24h: 0, drainPct: 12.5, thresholdMet: false, excluded: false },
    ...overrides,
  } as TapeRow;
}

const none = new Set<string>();

function reported(accountDisplayId: string, overrides: Partial<MultiScamBurstCase>): MultiScamBurstCase {
  return {
    scenario: 'phishing',
    scenarioName: 'Phishing takeover',
    institutionId: 'BANK_A',
    accountDisplayId,
    accountId: `acct_tok_${accountDisplayId}`,
    transfers: 5,
    decision: 'ALLOW',
    peakScore: 34,
    peakBand: 'LOW',
    assessmentId: 'asmt',
    drainPct: 10,
    held: [],
    ...overrides,
  };
}

describe('burst case board', () => {
  it('lays out three banks by four scam patterns, every tile waiting before the burst starts', () => {
    const board = buildBurstBoard({ rows: [], since: SINCE, report: null, contained: none, notified: none });
    expect(board.banks).toEqual(['Bank A', 'Bank B', 'Bank C']);
    expect(board.scenarios.map((scenario) => scenario.name)).toEqual(['Phishing takeover', 'Mule account', 'Smurfing', 'Credential replay']);
    expect(board.tiles).toHaveLength(12);
    expect(board.tiles[0]?.accountDisplayId).toBe('ACC-10291');
    expect(board.counts.queued).toBe(12);
  });

  it('follows the live tape: a case scoring turns LIVE, a case the gate held turns HELD at once', () => {
    const board = buildBurstBoard({
      rows: [row('ACC-10291', { score: 95, band: 'CRITICAL', decision: 'HOLD' }), row('ACC-10291', { score: 60 }), row('ACC-55902', { score: 50, band: 'ELEVATED' })],
      since: SINCE,
      report: null,
      contained: none,
      notified: none,
    });
    const phishingA = board.tiles.find((tile) => tile.accountDisplayId === 'ACC-10291');
    expect(phishingA).toMatchObject({ state: 'HELD', transfers: 2, score: 95, band: 'CRITICAL' });
    expect(board.tiles.find((tile) => tile.accountDisplayId === 'ACC-55902')?.state).toBe('LIVE');
    expect(board.transfers).toBe(3);
  });

  it('ignores rows from an earlier run and accounts outside the burst', () => {
    const board = buildBurstBoard({
      rows: [row('ACC-10291', { decidedAt: '2026-11-21T04:50:00.000Z', decision: 'HOLD' }), row('ACC-99999', { decision: 'HOLD' })],
      since: SINCE,
      report: null,
      contained: none,
      notified: none,
    });
    expect(board.counts.queued).toBe(12);
  });

  it("takes the report's outcome once it lands: held, agents' kill switch approved, flagged, monitored", () => {
    // The report's run plays on its own accounts, with their own references.
    const inRun = (catalogue: string) => runAccountReference(catalogue, 'run');
    const { swarm: _none, ...base } = reported('x', {});
    const report: MultiScamBurstReport = {
      runId: 'run',
      scenarioId: 'MULTI_SCAM_BURST_01',
      startedAt: '2026-11-21T05:00:00.000Z',
      finishedAt: '2026-11-21T05:00:40.000Z',
      transfers: 60,
      cases: [
        reported(inRun('ACC-10291'), { decision: 'HOLD', peakScore: 95, peakBand: 'CRITICAL', drainPct: 65.4 }),
        reported(inRun('ACC-55902'), { scenario: 'mule', peakScore: 66, peakBand: 'HIGH', swarm: {} as never }),
        reported(inRun('ACC-61284'), { scenario: 'replay', peakScore: 65, peakBand: 'HIGH', swarm: {} as never }),
        { ...base, accountDisplayId: inRun('ACC-82015'), scenario: 'smurf' },
      ],
    };
    const board = buildBurstBoard({ rows: [], since: SINCE, report, contained: new Set([inRun('ACC-55902')]), notified: new Set([inRun('ACC-10291')]) });
    const state = (id: string) => board.tiles.find((tile) => tile.accountDisplayId === id);
    expect(state(inRun('ACC-10291'))).toMatchObject({ state: 'HELD', drainPct: 65.4, notified: true });
    expect(state(inRun('ACC-55902'))?.state).toBe('CONTAINED');
    expect(state(inRun('ACC-61284'))?.state).toBe('FLAGGED');
    expect(state(inRun('ACC-82015'))?.state).toBe('MONITORED');
    expect(board.transfers).toBe(60);
  });

  it("follows a run's own account references, read from the run ID in its transaction IDs", () => {
    const reference = runAccountReference('ACC-10291', 'MWQ937HB');
    expect(reference).not.toBe('ACC-10291');
    const board = buildBurstBoard({
      rows: [row(reference, { transactionId: 'TX-MSB1-MWQ937HB-0007', decision: 'HOLD', score: 95, band: 'CRITICAL' })],
      since: SINCE,
      report: null,
      contained: none,
      notified: none,
    });
    const phishingA = board.tiles.find((tile) => tile.institutionId === 'BANK_A' && tile.scenario === 'phishing');
    expect(phishingA).toMatchObject({ accountDisplayId: reference, state: 'HELD', score: 95 });
  });
});
