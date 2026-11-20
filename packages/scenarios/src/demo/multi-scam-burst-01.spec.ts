import { MULTI_SCAM_BURST_01, REFERENCE_SCENARIOS, scaleReferenceAmount } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import { syntheticToken } from '../identity/synthetic-token.js';
import { buildMultiScamBurst01 } from './multi-scam-burst-01.js';

const EPOCH = '2026-11-21T03:00:00.000Z';

describe('MULTI_SCAM_BURST_01 scenario', () => {
  const burst = buildMultiScamBurst01(EPOCH);
  const caseOf = (scenario: string, institutionId: string) => {
    const found = burst.cases.find((entry) => entry.spec.scenario === scenario && entry.spec.institutionId === institutionId);
    if (!found) throw new Error(`no ${scenario} case on ${institutionId}`);
    return found;
  };
  const transfers = (timeline: (typeof burst.cases)[number]['timeline']) =>
    timeline.flatMap((step) => (step.action === 'TRANSFER' ? [step.request] : []));

  it('is identical for the same epoch', () => {
    expect(buildMultiScamBurst01(EPOCH)).toEqual(burst);
  });

  it('plays the reference four scenarios on all three banks, one account per case', () => {
    expect(burst.cases).toHaveLength(12);
    expect(new Set(burst.cases.map((entry) => entry.spec.accountDisplayId)).size).toBe(12);
    for (const key of Object.keys(REFERENCE_SCENARIOS)) {
      expect(burst.cases.filter((entry) => entry.spec.scenario === key).map((entry) => entry.spec.institutionId).sort()).toEqual(['BANK_A', 'BANK_B', 'BANK_C']);
    }
  });

  it('overlaps the cases in time', () => {
    const windows = burst.cases.map((entry) => [entry.timeline[0]!.atMs, entry.timeline.at(-1)!.atMs] as const);
    const overlapping = windows.filter(([start], index) => windows.some(([otherStart, otherEnd], other) => other !== index && start > otherStart && start < otherEnd));
    expect(overlapping.length).toBeGreaterThan(8);
  });

  it("keeps each case's own steps in order and only on its own account", () => {
    for (const entry of burst.cases) {
      const account = syntheticToken('acct', entry.spec.accountDisplayId);
      const offsets = entry.timeline.map((step) => step.atMs);
      expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
      for (const request of transfers(entry.timeline)) expect(request.sourceAccountToken).toBe(account);
    }
  });

  it('scales the phishing amounts by the account balance exactly as the reference does', () => {
    const phishingB = caseOf('phishing', 'BANK_B');
    const reference = REFERENCE_SCENARIOS.phishing.steps.flatMap((step) => (step.kind === 'transfer' ? [step.amount] : []));
    const expected = [REFERENCE_SCENARIOS.phishing.priorOutflow, ...reference].map((amount) => scaleReferenceAmount(amount, 'demo', 6_100_000));
    expect(transfers(phishingB.timeline).map((request) => request.amount)).toEqual(expected);
    expect(expected[1]).toBe(281_500);
  });

  it('plays the mule role at its own balance and forwards to the other banks', () => {
    const muleA = caseOf('mule', 'BANK_A');
    const amounts = transfers(muleA.timeline).map((request) => request.amount);
    expect(amounts).toEqual([20_000, 420_000, 430_000]);
    expect(transfers(muleA.timeline).slice(1).every((request) => request.destinationInstitutionId === 'BANK_C')).toBe(true);
    expect(muleA.timeline.some((step) => step.action === 'SECURITY_EVENT' && step.event.eventType === 'MOBILE_NUMBER_CHANGED')).toBe(true);
  });

  it("dates the smurfing payee two hours before the case and keeps the reference's eight small transfers", () => {
    const smurfC = caseOf('smurf', 'BANK_C');
    const payee = smurfC.timeline.find((step) => step.action === 'ADD_PAYEE');
    expect(payee && payee.action === 'ADD_PAYEE' && payee.event.occurredAt).toBe(new Date(Date.parse(EPOCH) - 2 * 3_600_000).toISOString());
    expect(transfers(smurfC.timeline)).toHaveLength(9);
  });

  it('starts the credential replay with a password reset that opens cooling-off', () => {
    const replayA = caseOf('replay', 'BANK_A');
    const first = replayA.timeline.find((step) => step.action === 'SECURITY_EVENT' || step.action === 'LOGIN_NEW_DEVICE' || step.action === 'ADD_PAYEE');
    expect(first && 'event' in first && first.event.eventType).toBe('PASSWORD_CHANGED');
  });

  it('merges every case into one time-ordered scenario', () => {
    expect(burst.scenario.id).toBe(MULTI_SCAM_BURST_01.scenarioId);
    expect(burst.scenario.timeline).toHaveLength(burst.cases.reduce((sum, entry) => sum + entry.timeline.length, 0));
  });
});
