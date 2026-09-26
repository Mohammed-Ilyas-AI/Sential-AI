import { DEMO_TAKEOVER_01 } from '@sentinel/domain';
import { ScenarioEventFactory } from '../catalogue/scenario-event-factory.js';
import { SYNTHETIC_ACCOUNTS } from '../catalogue/synthetic-roster.js';
import { baselineGenerator } from '../generators/baseline.generator.js';
import { muleNetworkGenerator } from '../generators/mule-network.generator.js';
import { takeoverGenerator } from '../generators/takeover.generator.js';
import type { Scenario, ScenarioStep } from '../scenario.js';
import { createSeededRandom } from '../seed/seeded-random.js';

export type BuildDemoScenario = (epoch: string) => Scenario;

/**
 * DEMO_TAKEOVER_01: baseline traffic across twelve accounts, the mule network, then the takeover of ACC-10291.
 * Deterministic for a given epoch: the same seed, the same events, the same decisions.
 */
export const buildDemoTakeover01: BuildDemoScenario = (epoch) => {
  const random = createSeededRandom(DEMO_TAKEOVER_01.seed);
  const events = new ScenarioEventFactory('DT01', Date.parse(epoch));
  const victim = SYNTHETIC_ACCOUNTS.find((account) => account.displayId === DEMO_TAKEOVER_01.accountDisplayId);
  if (!victim) throw new Error(`${DEMO_TAKEOVER_01.accountDisplayId} is missing from the synthetic roster`);

  const finalTransfer = DEMO_TAKEOVER_01.steps.find((step) => 'expectedDecision' in step && step.expectedDecision === 'HOLD');
  if (!finalTransfer || finalTransfer.action !== 'TRANSFER') throw new Error('DEMO_TAKEOVER_01 has no held transfer');

  const baseline = baselineGenerator.generate(random, {
    events,
    quietAccounts: [victim.displayId],
    windowMs: DEMO_TAKEOVER_01.baselineWindowMs,
  });
  const network: ScenarioStep = {
    atMs: 0,
    action: 'OBSERVE_NETWORK',
    observation: muleNetworkGenerator.generate(random, {
      destinationPayeeId: finalTransfer.payeeId,
      destinationInstitutionId: finalTransfer.destinationInstitutionId,
      flaggedLinks: DEMO_TAKEOVER_01.finalPayeeFlaggedLinks,
      observedAt: events.hoursBefore(2),
    }),
  };
  const takeover = takeoverGenerator.generate(random, { events, victim });

  const timeline = [...baseline, network, ...takeover].sort((left, right) => left.atMs - right.atMs);
  return { id: DEMO_TAKEOVER_01.scenarioId, seed: DEMO_TAKEOVER_01.seed, epoch, timeline };
};
