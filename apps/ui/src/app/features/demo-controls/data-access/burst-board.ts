import { MULTI_SCAM_BURST_01, REFERENCE_SCENARIOS, type MultiScamBurstReport, type ReferenceScenarioKey, type RiskBand } from '@sentinel/domain';
import type { TapeRow } from '../../../workers/transaction-worker-protocol';

/**
 * Where one case of the burst stands, as the audience should read it:
 * QUEUED (not started), LIVE (transfers being decided), HELD (the gate held a transfer), FLAGGED (the gate let it
 * through but it scored HIGH or CRITICAL and the agents are on it), CONTAINED (the analyst approved the agents' kill
 * switch), MONITORED (scored low and left in the queue).
 */
export type BurstTileState = 'QUEUED' | 'LIVE' | 'HELD' | 'FLAGGED' | 'CONTAINED' | 'MONITORED';

export interface BurstTile {
  readonly accountDisplayId: string;
  readonly institutionId: string;
  readonly scenario: ReferenceScenarioKey;
  readonly state: BurstTileState;
  /** Transfers decided so far, and the highest score among them: the engine's numbers, never estimated here. */
  readonly transfers: number;
  readonly score: number | null;
  readonly band: RiskBand | null;
  readonly drainPct: number | null;
  readonly notified: boolean;
}

export interface BurstBoard {
  readonly banks: readonly string[];
  readonly scenarios: readonly { readonly key: ReferenceScenarioKey; readonly name: string }[];
  /** One tile per bank and scenario, in `banks` × `scenarios` order. */
  readonly tiles: readonly BurstTile[];
  readonly counts: Readonly<Record<'held' | 'flagged' | 'contained' | 'monitored' | 'live' | 'queued', number>>;
  readonly transfers: number;
}

export interface BurstBoardInput {
  /** The live tape: rows for the burst's accounts decided since the burst began. */
  readonly rows: readonly TapeRow[];
  /** When this burst started (browser clock); rows decided before it belong to an earlier run. */
  readonly since: number;
  readonly report: MultiScamBurstReport | null;
  /** Display ids of accounts whose kill switch the analyst approved and sentinel-core accepted. */
  readonly contained: ReadonlySet<string>;
  /** Display ids of customers who have been sent a push. */
  readonly notified: ReadonlySet<string>;
}

/** Clocks of browser and server can differ by a little; anything this much before the start is an earlier run. */
const CLOCK_SLACK_MS = 5_000;
const BANKS = ['BANK_A', 'BANK_B', 'BANK_C'] as const;
const SCENARIOS: readonly ReferenceScenarioKey[] = ['phishing', 'mule', 'smurf', 'replay'];

/**
 * The case board for MULTI_SCAM_BURST_01: twelve tiles, three banks by four scam patterns. While the burst plays,
 * each tile follows the live tape; once sentinel-core's report lands, the report's outcome is the tile's outcome.
 */
export function buildBurstBoard(input: BurstBoardInput): BurstBoard {
  const byAccount = new Map<string, TapeRow[]>();
  const ids = new Set(MULTI_SCAM_BURST_01.cases.map((spec) => spec.accountDisplayId));
  for (const row of input.rows) {
    const reference = row.accountReference;
    if (!reference || !ids.has(reference) || Date.parse(row.decidedAt) < input.since - CLOCK_SLACK_MS) continue;
    byAccount.set(reference, [...(byAccount.get(reference) ?? []), row]);
  }
  const reported = new Map((input.report?.cases ?? []).map((entry) => [entry.accountDisplayId, entry]));

  const tiles = BANKS.flatMap((bank) =>
    SCENARIOS.map((scenario): BurstTile => {
      const spec = MULTI_SCAM_BURST_01.cases.find((candidate) => candidate.institutionId === bank && candidate.scenario === scenario);
      const displayId = spec?.accountDisplayId ?? '';
      const rows = byAccount.get(displayId) ?? [];
      const peak = rows.reduce<TapeRow | null>((best, row) => (!best || row.score > best.score ? row : best), null);
      const live = {
        transfers: rows.length,
        score: peak?.score ?? null,
        band: peak?.band ?? null,
        drainPct: rows.reduce<number | null>((most, row) => Math.max(most ?? 0, row.drain.drainPct), null),
      };
      const outcome = reported.get(displayId);
      const base = { accountDisplayId: displayId, institutionId: bank, scenario, notified: input.notified.has(displayId) };
      if (outcome) {
        const state: BurstTileState =
          outcome.decision !== 'ALLOW' ? 'HELD' : input.contained.has(displayId) ? 'CONTAINED' : outcome.swarm ? 'FLAGGED' : 'MONITORED';
        return { ...base, state, transfers: outcome.transfers, score: outcome.peakScore, band: outcome.peakBand, drainPct: outcome.drainPct };
      }
      const held = rows.some((row) => row.decision !== 'ALLOW');
      return { ...base, ...live, state: held ? 'HELD' : rows.length > 0 ? 'LIVE' : 'QUEUED' };
    }),
  );

  const count = (state: BurstTileState) => tiles.filter((tile) => tile.state === state).length;
  return {
    banks: BANKS.map((bank) => bank.replace('BANK_', 'Bank ')),
    scenarios: SCENARIOS.map((key) => ({ key, name: REFERENCE_SCENARIOS[key].name })),
    tiles,
    counts: {
      held: count('HELD'),
      flagged: count('FLAGGED'),
      contained: count('CONTAINED'),
      monitored: count('MONITORED'),
      live: count('LIVE'),
      queued: count('QUEUED'),
    },
    transfers: input.report?.transfers ?? tiles.reduce((sum, tile) => sum + tile.transfers, 0),
  };
}
