import { DEMO_TAKEOVER_01, type EdgeLinkage } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import { accountFixture, drainFixture, transactionFixture, windowFixture } from '../testing/risk-inputs.fixture.js';
import { assess } from './assess.js';
import { bandFor } from './band-for.js';
import { RISK_RULES } from './rule-registry.js';

/** The DEMO_TAKEOVER_01 inputs at each transfer, as the HTML reference feeds them to its engine. */
function assessDemoTransfer(input: {
  readonly outflowIncludingTransfer: number;
  readonly amount: number;
  readonly velocityRatio: number;
  readonly payeeAgeHours: number;
  readonly flaggedLinks?: readonly EdgeLinkage[];
}) {
  const drainPct = (input.outflowIncludingTransfer / DEMO_TAKEOVER_01.openingBalance) * 100;
  return assess(
    transactionFixture({ amount: input.amount }),
    accountFixture(),
    windowFixture({
      drain: drainFixture(drainPct, { outflow24h: input.outflowIncludingTransfer }),
      features: {
        deviceAgeHours: 0.07,
        payeeAgeHours: input.payeeAgeHours,
        velocityRatio: input.velocityRatio,
        flaggedLinks: input.flaggedLinks ?? [],
      },
    }),
    RISK_RULES,
  );
}

const pointsByCode = (assessment: ReturnType<typeof assess>) =>
  Object.fromEntries(assessment.contributions.map((contribution) => [contribution.code, contribution.points]));

describe('assess() — DEMO_TAKEOVER_01 ladder from the HTML reference', () => {
  it('scores 37 LOW on the first S$2,400 transfer (new device + new payee only)', () => {
    const assessment = assessDemoTransfer({ outflowIncludingTransfer: 1_040_000, amount: 240_000, velocityRatio: 1.8, payeeAgeHours: 0.002 });
    expect(assessment.score).toBe(37);
    expect(assessment.band).toBe('LOW');
  });

  it('scores 49 ELEVATED at 29.4% drain', () => {
    const assessment = assessDemoTransfer({ outflowIncludingTransfer: 1_530_000, amount: 490_000, velocityRatio: 3.5, payeeAgeHours: 0.002 });
    expect(pointsByCode(assessment)).toEqual({ NEW_DEVICE: 21, NEW_PAYEE: 16, RAPID_DRAIN: 5, BEHAVIOUR_DEV: 4, VELOCITY: 3 });
    expect(assessment.score).toBe(49);
    expect(assessment.band).toBe('ELEVATED');
  });

  it('scores 75 HIGH at 43.3% drain', () => {
    const assessment = assessDemoTransfer({ outflowIncludingTransfer: 2_250_000, amount: 720_000, velocityRatio: 4.5, payeeAgeHours: 0.003 });
    expect(pointsByCode(assessment)).toEqual({ NEW_DEVICE: 21, NEW_PAYEE: 16, RAPID_DRAIN: 22, VELOCITY: 9, BEHAVIOUR_DEV: 7 });
    expect(assessment.score).toBe(75);
    expect(assessment.band).toBe('HIGH');
  });

  it('scores 95 CRITICAL at 65.4% drain with the documented six contributions', () => {
    const assessment = assessDemoTransfer({
      outflowIncludingTransfer: 3_400_000,
      amount: 1_150_000,
      velocityRatio: 5.5,
      payeeAgeHours: 0.001,
      flaggedLinks: DEMO_TAKEOVER_01.finalPayeeFlaggedLinks,
    });
    expect(pointsByCode(assessment)).toEqual(DEMO_TAKEOVER_01.finalContributions);
    expect(assessment.score).toBe(95);
    expect(assessment.band).toBe('CRITICAL');
  });
});

describe('assess() — invariants', () => {
  const assessment = assessDemoTransfer({
    outflowIncludingTransfer: 3_400_000,
    amount: 1_150_000,
    velocityRatio: 5.5,
    payeeAgeHours: 0.001,
    flaggedLinks: DEMO_TAKEOVER_01.finalPayeeFlaggedLinks,
  });

  it('produces a score equal to the sum of contribution points', () => {
    expect(assessment.score).toBe(assessment.contributions.reduce((sum, contribution) => sum + contribution.points, 0));
  });

  it('sorts contributions by points, highest first', () => {
    const points = assessment.contributions.map((contribution) => contribution.points);
    expect(points).toEqual([...points].sort((left, right) => right - left));
  });

  it('returns the same assessment for the same inputs, every time', () => {
    const again = assessDemoTransfer({
      outflowIncludingTransfer: 3_400_000,
      amount: 1_150_000,
      velocityRatio: 5.5,
      payeeAgeHours: 0.001,
      flaggedLinks: DEMO_TAKEOVER_01.finalPayeeFlaggedLinks,
    });
    expect(again).toEqual(assessment);
  });

  it('omits rules that contribute nothing', () => {
    const quiet = assess(transactionFixture(), accountFixture(), windowFixture(), RISK_RULES);
    expect(quiet.contributions).toEqual([]);
    expect(quiet.score).toBe(0);
    expect(quiet.band).toBe('LOW');
  });
});

describe('bandFor()', () => {
  it('maps band boundaries exactly', () => {
    expect([bandFor(39), bandFor(40)]).toEqual(['LOW', 'ELEVATED']);
    expect([bandFor(64), bandFor(65)]).toEqual(['ELEVATED', 'HIGH']);
    expect([bandFor(84), bandFor(85)]).toEqual(['HIGH', 'CRITICAL']);
  });
});
