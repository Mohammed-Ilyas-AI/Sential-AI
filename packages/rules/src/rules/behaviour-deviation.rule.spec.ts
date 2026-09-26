import { describe, expect, it } from 'vitest';
import { accountFixture, transactionFixture, windowFixture } from '../testing/risk-inputs.fixture.js';
import { behaviourDeviationRule } from './behaviour-deviation.rule.js';

const pointsFor = (amount: number, amountP95 = 300_000): number | undefined =>
  behaviourDeviationRule.evaluate(transactionFixture({ amount }), accountFixture(), windowFixture({ features: { amountP95 } }))
    ?.points;

describe('BEHAVIOUR_DEV rule', () => {
  it('declares its code and the documented maximum of 7 points', () => {
    expect(behaviourDeviationRule.code).toBe('BEHAVIOUR_DEV');
    expect(behaviourDeviationRule.maxPoints).toBe(7);
  });

  it('scores nothing at or below the 95th-percentile amount', () => {
    expect(pointsFor(240_000)).toBeUndefined();
    expect(pointsFor(300_000)).toBeUndefined();
  });

  it('reproduces the reference curve at the DEMO_TAKEOVER_01 amounts', () => {
    expect(pointsFor(490_000)).toBe(4);
    expect(pointsFor(720_000)).toBe(7);
    expect(pointsFor(1_150_000)).toBe(7);
  });

  it('describes the amount against the percentile', () => {
    const contribution = behaviourDeviationRule.evaluate(
      transactionFixture({ amount: 1_150_000 }),
      accountFixture(),
      windowFixture(),
    );
    expect(contribution?.detail).toBe('S$11,500, above the 95th percentile of S$3,000');
  });

  it('scores nothing without a usable percentile', () => {
    expect(pointsFor(1_000_000, 0)).toBeUndefined();
  });
});
