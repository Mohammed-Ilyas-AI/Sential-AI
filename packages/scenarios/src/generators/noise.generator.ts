import { DEMO_TAKEOVER_01, SCENARIO_NOISE_MAX_RATE_PER_MINUTE } from '@sentinel/domain';
import { isScenarioRunId } from '../identity/scenario-run.js';
import type { Scenario, ScenarioStep } from '../scenario.js';
import { ScenarioEventFactory } from '../catalogue/scenario-event-factory.js';
import { SYNTHETIC_ACCOUNTS } from '../catalogue/synthetic-roster.js';
import { createSeededRandom } from '../seed/seeded-random.js';
import type { ScenarioGenerator } from './scenario-generator.js';

export interface NoiseInput {
  readonly events: ScenarioEventFactory;
  readonly ratePerMinute: number;
}

const NOISE_WINDOW_MS = 60_000;

/** Independent, low-frequency synthetic anomalies. Never reuses DEMO_TAKEOVER_01's victim or run-scoped IDs. */
export const noiseGenerator: ScenarioGenerator<NoiseInput, readonly ScenarioStep[]> = {
  name: 'noise',
  generate(random, { events, ratePerMinute }) {
    if (!Number.isInteger(ratePerMinute) || ratePerMinute < 1 || ratePerMinute > SCENARIO_NOISE_MAX_RATE_PER_MINUTE) {
      throw new RangeError(`Noise rate must be an integer from 1 to ${SCENARIO_NOISE_MAX_RATE_PER_MINUTE} events per minute`);
    }

    const accounts = SYNTHETIC_ACCOUNTS.filter((account) => account.displayId !== DEMO_TAKEOVER_01.accountDisplayId);
    for (let index = accounts.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random.next() * (index + 1));
      [accounts[index], accounts[swap]] = [accounts[swap]!, accounts[index]!];
    }
    const steps: ScenarioStep[] = accounts.map((account) => ({
      atMs: 0,
      action: 'REPORT_ACCOUNT',
      report: events.accountReport(account, 1_600_000, 1, events.at(0)),
    }));

    for (let index = 0; index < ratePerMinute; index += 1) {
      const account = accounts[Math.floor(random.next() * accounts.length)];
      if (!account) throw new Error('Noise account selection failed');
      const start = Math.floor((index * NOISE_WINDOW_MS) / ratePerMinute);
      const deviceId = `DEV-NOISE-${String(index + 1).padStart(2, '0')}`;
      const payeeId = `PAYEE-NOISE-${String(index + 1).padStart(2, '0')}`;
      steps.push(
        {
          atMs: start + 100,
          action: 'LOGIN_NEW_DEVICE',
          event: events.securityEvent(account, 'NEW_DEVICE', events.at(start + 100), { deviceId }),
        },
        {
          atMs: start + 200,
          action: 'ADD_PAYEE',
          event: events.securityEvent(account, 'PAYEE_ADDED', events.at(start + 200), { payeeId }),
        },
      );
      const { request, lifecycleOnAllow } = events.transfer({
        source: account,
        payeeId,
        destinationInstitutionId: account.institutionId,
        amount: 490_000,
        deviceId,
        occurredAt: events.at(start + 300),
      });
      steps.push({ atMs: start + 300, action: 'TRANSFER', request, lifecycleOnAllow });
    }
    return steps;
  },
};

/** Run-scoped identifiers keep background traffic isolated from the canonical scenario and from previous runs. */
export function buildSeededNoiseScenario(epoch: string, seed: number, runId: string, ratePerMinute: number): Scenario {
  if (!Number.isFinite(Date.parse(epoch))) throw new RangeError('Noise scenario epoch must be a valid timestamp');
  if (!Number.isSafeInteger(seed)) throw new RangeError('Noise scenario seed must be a safe integer');
  if (!isScenarioRunId(runId)) throw new RangeError('Noise scenario runId must be 1-12 letters or digits');
  const events = new ScenarioEventFactory('NOISE', Date.parse(epoch), runId);
  const timeline = noiseGenerator.generate(createSeededRandom(seed), { events, ratePerMinute });
  return { id: 'BACKGROUND_NOISE', seed, epoch, runId, timeline };
}
