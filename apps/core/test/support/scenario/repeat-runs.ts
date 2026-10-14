import { DEMO_TAKEOVER_01 } from '@sentinel/domain';
import { INSTANT_TIMELINE, buildDemoTakeover01, playScenario, runScopedToken, type PlaybackReport } from '@sentinel/scenarios';
import type { SentinelPersistence } from '../../../src/composition/mongo-persistence.composition.js';
import type { CoreHarness } from '../harness/core-test-harness.js';
import { HttpBankConnector } from '../harness/http-bank-connector.js';

export const FIRST_EPOCH = '2026-09-24T11:30:00.000Z';
/** The repeat demo ten minutes later: well inside the first run's 24-hour window and its hold. */
export const SECOND_EPOCH = '2026-09-24T11:40:00.000Z';
export const DOCUMENTED_SCORES = DEMO_TAKEOVER_01.steps.flatMap((step) => (step.action === 'TRANSFER' ? [step.expectedScore] : []));

export interface RepeatRunsResult {
  readonly first: PlaybackReport;
  readonly second: PlaybackReport;
  readonly replay: PlaybackReport;
}

/** Two separate runs into one store, then run one replayed exactly. Shared with the Atlas integration suite. */
export async function playTwoRunsAndAReplay(harness: CoreHarness): Promise<RepeatRunsResult> {
  const play = (epoch: string, runId: string) =>
    playScenario(buildDemoTakeover01(epoch, { runId }), new HttpBankConnector(harness.baseUrl, harness.clock), INSTANT_TIMELINE);
  const first = await play(FIRST_EPOCH, 'RUNA');
  const second = await play(SECOND_EPOCH, 'RUNB');
  const replay = await play(FIRST_EPOCH, 'RUNA');
  return { first, second, replay };
}

export const victimOf = (runId: string) => runScopedToken('acct', DEMO_TAKEOVER_01.accountDisplayId, runId);

export const scriptedTransfers = (report: PlaybackReport, runId: string) =>
  report.transfers.filter((transfer) => transfer.step.request.sourceAccountToken === victimOf(runId)).slice(1);

export async function outflowInWindow(persistence: SentinelPersistence, report: PlaybackReport, runId: string): Promise<number> {
  const final = scriptedTransfers(report, runId).at(-1);
  if (!final) throw new Error('The final transfer was not played');
  return persistence.outflowWindow.effectiveOutflow({
    accountId: victimOf(runId),
    afterExclusive: new Date(Date.parse(final.step.request.occurredAt) - 24 * 3_600_000).toISOString(),
    upToInclusive: final.step.request.occurredAt,
    eligibleForDrainOnly: true,
  });
}
