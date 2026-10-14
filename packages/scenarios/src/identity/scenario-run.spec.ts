import { DEMO_TAKEOVER_01 } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import { buildDemoTakeover01 } from '../demo/demo-takeover-01.js';
import type { Scenario } from '../scenario.js';
import { isScenarioRunId, newScenarioRunId, runScopedToken } from './scenario-run.js';
import { syntheticToken } from './synthetic-token.js';

const EPOCH = '2026-09-24T11:30:00.000Z';

/**
 * Every identifier a scenario emits: event, transaction and idempotency keys, and every synthetic token. Evidence
 * citations on network edges (a cited payment reference) are not identity — edges are keyed by from|to|kind.
 */
function identifiersOf(scenario: Scenario): Set<string> {
  const found = new Set<string>();
  const visit = (value: unknown, key = ''): void => {
    if (typeof value === 'string') {
      if (/(Id|Key|Token|Tokens|id|from|to|rootId)$/.test(key) && !/^(BANK_|schemaVersion)/.test(value) && key !== 'tenantId' && key !== 'institutionId') {
        found.add(value);
      }
      return;
    }
    if (Array.isArray(value)) value.forEach((item) => visit(item, key));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([childKey, child]) => visit(child, childKey));
  };
  visit(scenario.timeline);
  return found;
}

const transfersOf = (scenario: Scenario) =>
  scenario.timeline.flatMap((step) => (step.action === 'TRANSFER' ? [{ atMs: step.atMs, amount: step.request.amount, type: step.request.type, occurredAt: step.request.occurredAt }] : []));

describe('scenario runs', () => {
  it('leaves an unscoped scenario exactly as it was: canonical tokens and IDs', () => {
    const scenario = buildDemoTakeover01(EPOCH);
    const victim = syntheticToken('acct', DEMO_TAKEOVER_01.accountDisplayId);
    const transfers = scenario.timeline.flatMap((step) => (step.action === 'TRANSFER' ? [step.request] : []));
    expect(transfers.some((request) => request.sourceAccountToken === victim)).toBe(true);
    expect(transfers[0]?.transactionId).toMatch(/^TX-DT01-\d{4}$/);
    expect(scenario.runId).toBeUndefined();
    expect(runScopedToken('acct', 'ACC-10291')).toBe(syntheticToken('acct', 'ACC-10291'));
  });

  it('gives two runs no identifier in common, so neither replays the other', () => {
    const first = identifiersOf(buildDemoTakeover01(EPOCH, { runId: 'RUN1' }));
    const second = identifiersOf(buildDemoTakeover01(EPOCH, { runId: 'RUN2' }));
    expect(first.size).toBeGreaterThan(50);
    expect([...first].filter((identifier) => second.has(identifier))).toEqual([]);
  });

  it('keeps every amount, type and time identical across runs, so each run scores the same', () => {
    expect(transfersOf(buildDemoTakeover01(EPOCH, { runId: 'RUN1' }))).toEqual(transfersOf(buildDemoTakeover01(EPOCH, { runId: 'RUN2' })));
    expect(transfersOf(buildDemoTakeover01(EPOCH, { runId: 'RUN1' }))).toEqual(transfersOf(buildDemoTakeover01(EPOCH)));
  });

  it('reproduces the same run exactly, which is what makes a retry inside a run idempotent', () => {
    expect(buildDemoTakeover01(EPOCH, { runId: 'RUN1' })).toEqual(buildDemoTakeover01(EPOCH, { runId: 'RUN1' }));
  });

  it('scopes the network observation to the run, so ENTITY_LINK still finds the run’s own mules', () => {
    const scenario = buildDemoTakeover01(EPOCH, { runId: 'RUN1' });
    const network = scenario.timeline.find((step) => step.action === 'OBSERVE_NETWORK');
    const finalPayee = scenario.timeline.flatMap((step) => (step.action === 'TRANSFER' ? [step.request] : [])).at(-1)?.destinationAccountToken;
    if (network?.action !== 'OBSERVE_NETWORK') throw new Error('no network step');
    expect(network.observation.edges.every((edge) => edge.from === finalPayee)).toBe(true);
    expect(network.observation.nodes.map((node) => node.id)).not.toContain(syntheticToken('acct', 'ACC-55902'));
  });

  it('issues time-based run IDs that are valid and distinct', () => {
    const first = newScenarioRunId(Date.parse(EPOCH));
    const second = newScenarioRunId(Date.parse(EPOCH) + 1);
    expect(isScenarioRunId(first) && isScenarioRunId(second)).toBe(true);
    expect(first).not.toBe(second);
    expect(isScenarioRunId('not valid!')).toBe(false);
  });
});
