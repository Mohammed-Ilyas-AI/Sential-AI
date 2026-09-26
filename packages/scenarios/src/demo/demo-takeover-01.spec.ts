import { DEMO_TAKEOVER_01 } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import { syntheticToken } from '../identity/synthetic-token.js';
import { buildDemoTakeover01 } from './demo-takeover-01.js';

const EPOCH = '2026-09-24T11:30:00.000Z';
const victimToken = syntheticToken('acct', 'ACC-10291');

describe('DEMO_TAKEOVER_01 scenario', () => {
  const scenario = buildDemoTakeover01(EPOCH);
  const victimTransfers = scenario.timeline.filter(
    (step) => step.action === 'TRANSFER' && step.request.sourceAccountToken === victimToken,
  );

  it('produces an identical timeline for the same epoch', () => {
    expect(buildDemoTakeover01(EPOCH)).toEqual(scenario);
  });

  it('reports all twelve synthetic accounts before any traffic', () => {
    const reports = scenario.timeline.filter((step) => step.action === 'REPORT_ACCOUNT' && step.atMs === 0);
    expect(new Set(reports.map((step) => step.action === 'REPORT_ACCOUNT' && step.report.displayReference)).size).toBe(12);
  });

  it('builds the four documented transfers plus S$8,000 of prior activity inside the window', () => {
    const amounts = victimTransfers.map((step) => step.action === 'TRANSFER' && step.request.amount);
    expect(amounts).toEqual([800_000, 240_000, 490_000, 720_000, 1_150_000]);
    const total = amounts.reduce<number>((sum, amount) => sum + (amount || 0), 0);
    expect(total).toBe(DEMO_TAKEOVER_01.totalMovedInWindow);
  });

  it('keeps the takeover on the documented clock', () => {
    const offsets = scenario.timeline
      .filter((step) => step.atMs >= 30_000)
      .filter((step) => step.action !== 'REPORT_ACCOUNT')
      .map((step) => `${step.atMs}:${step.action}`);
    expect(offsets).toEqual([
      '30000:LOGIN_NEW_DEVICE',
      '34000:ADD_PAYEE',
      '41000:TRANSFER',
      '42000:TRANSFER',
      '42500:ADD_PAYEE',
      '43000:TRANSFER',
      '44000:ADD_PAYEE',
      '45000:TRANSFER',
    ]);
  });

  it('numbers every event for an account in strictly increasing order', () => {
    const sequences = victimTransfers.flatMap((step) =>
      step.action === 'TRANSFER' ? [step.request.accountSequence, ...step.lifecycleOnAllow.map((event) => event.accountSequence)] : [],
    );
    expect(sequences).toEqual([...sequences].sort((left, right) => left - right));
    expect(new Set(sequences).size).toBe(sequences.length);
  });

  it('seeds exactly the reference flagged links around the final payee', () => {
    const network = scenario.timeline.find((step) => step.action === 'OBSERVE_NETWORK');
    const linkages = network?.action === 'OBSERVE_NETWORK' ? network.observation.edges.map((edge) => edge.evidence.linkage) : [];
    expect(linkages).toEqual(DEMO_TAKEOVER_01.finalPayeeFlaggedLinks);
  });

  it('uses only synthetic tokens on the wire', () => {
    const serialised = JSON.stringify(scenario.timeline.filter((step) => step.action !== 'REPORT_ACCOUNT'));
    expect(serialised).not.toContain('ACC-10291');
  });
});
