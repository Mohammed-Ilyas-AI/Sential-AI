import { MULTI_SCAM_BURST_01, type MultiScamBurstCaseSpec } from '@sentinel/domain';
import { ScenarioEventFactory } from '../catalogue/scenario-event-factory.js';
import { SYNTHETIC_ACCOUNTS, type SyntheticAccount } from '../catalogue/synthetic-roster.js';
import { referenceScenarioGenerator } from '../generators/reference-scenario.generator.js';
import type { ScenarioRunId } from '../identity/scenario-run.js';
import type { Scenario, ScenarioStep } from '../scenario.js';
import { createSeededRandom } from '../seed/seeded-random.js';

/** One case of the burst, with its own timeline so it can be played alongside the others. */
export interface MultiScamBurstCaseScenario {
  readonly spec: MultiScamBurstCaseSpec;
  readonly account: SyntheticAccount;
  readonly timeline: readonly ScenarioStep[];
}

export interface MultiScamBurstScenario {
  /** Every case merged in time order: the same events, for a caller that plays one timeline. */
  readonly scenario: Scenario;
  readonly cases: readonly MultiScamBurstCaseScenario[];
}

/**
 * MULTI_SCAM_BURST_01: the reference's four scenarios on all three banks, twelve cases that overlap in time.
 * Deterministic for a given epoch and run. Each case touches only its own account, so the cases can be played
 * concurrently; within a case the steps stay in order, as a bank's orchestrator would send them.
 */
export function buildMultiScamBurst01(epoch: string, options: { readonly runId?: ScenarioRunId } = {}): MultiScamBurstScenario {
  const random = createSeededRandom(MULTI_SCAM_BURST_01.seed);
  const events = new ScenarioEventFactory('MSB1', Date.parse(epoch), options.runId);
  const cases = MULTI_SCAM_BURST_01.cases.map((spec): MultiScamBurstCaseScenario => {
    const account = SYNTHETIC_ACCOUNTS.find((candidate) => candidate.displayId === spec.accountDisplayId);
    if (!account) throw new Error(`${spec.accountDisplayId} is missing from the synthetic roster`);
    if (account.institutionId !== spec.institutionId) throw new Error(`${spec.accountDisplayId} is not a ${spec.institutionId} account`);
    return { spec, account, timeline: referenceScenarioGenerator.generate(random, { events, account, spec, cross: MULTI_SCAM_BURST_01.cross }) };
  });
  const timeline = cases.flatMap((entry) => entry.timeline).sort((left, right) => left.atMs - right.atMs);
  return {
    scenario: { id: MULTI_SCAM_BURST_01.scenarioId, seed: MULTI_SCAM_BURST_01.seed, epoch, ...(options.runId ? { runId: options.runId } : {}), timeline },
    cases,
  };
}
