import { DEMO_TAKEOVER_01 } from '@sentinel/domain';
import type { ScenarioEventFactory } from '../catalogue/scenario-event-factory.js';
import { ESTABLISHED_PAYEES, SYNTHETIC_ACCOUNTS } from '../catalogue/synthetic-roster.js';
import type { ScenarioStep } from '../scenario.js';
import type { SeededRandom } from '../seed/seeded-random.js';
import type { ScenarioGenerator } from './scenario-generator.js';

export interface BaselineInput {
  readonly events: ScenarioEventFactory;
  readonly quietAccounts: readonly string[];
  readonly windowMs: number;
}

const STEP_SPACING_MS = 1_250;

/**
 * Normal traffic: account reports for the twelve synthetic accounts, then small transfers to established payees
 * from known devices. Every one scores LOW; the demo proves the system does not alarm on everything.
 */
export const baselineGenerator: ScenarioGenerator<BaselineInput, readonly ScenarioStep[]> = {
  name: 'baseline',
  generate(random, { events, quietAccounts, windowMs }) {
    const reports: ScenarioStep[] = SYNTHETIC_ACCOUNTS.map((account) => ({
      atMs: 0,
      action: 'REPORT_ACCOUNT',
      report: events.accountReport(
        account,
        account.balance ?? 1_800_000 + Math.floor(random.next() * 2_600_000),
        1,
        events.at(0),
      ),
    }));

    const active = SYNTHETIC_ACCOUNTS.filter((account) => !quietAccounts.includes(account.displayId));
    const transfers: ScenarioStep[] = [];
    for (let atMs = 1_000; atMs < windowMs; atMs += STEP_SPACING_MS) {
      const source = pick(random, active);
      const payeeId = pick(random, ESTABLISHED_PAYEES);
      const draw = random.next();
      const { request, lifecycleOnAllow } = events.transfer({
        source,
        payeeId,
        destinationInstitutionId: source.institutionId,
        amount: Math.floor(1_500 + draw * draw * 148_500),
        deviceId: events.homeDevice(source),
        occurredAt: events.at(atMs),
      });
      transfers.push({ atMs, action: 'TRANSFER', request, lifecycleOnAllow });
    }
    return [...reports, ...transfers];
  },
};

function pick<T>(random: SeededRandom, items: readonly T[]): T {
  const item = items[Math.floor(random.next() * items.length)];
  if (item === undefined) throw new Error('Cannot pick from an empty list');
  return item;
}

export const DEFAULT_BASELINE_WINDOW_MS = DEMO_TAKEOVER_01.baselineWindowMs;
