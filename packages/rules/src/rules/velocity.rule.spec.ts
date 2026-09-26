import { describe, expect, it } from 'vitest';
import { accountFixture, transactionFixture, windowFixture } from '../testing/risk-inputs.fixture.js';
import { velocityRule } from './velocity.rule.js';

const pointsAt = (velocityRatio: number): number | undefined =>
  velocityRule.evaluate(transactionFixture(), accountFixture(), windowFixture({ features: { velocityRatio } }))?.points;

describe('VELOCITY rule', () => {
  it('declares its code and the documented maximum of 12 points', () => {
    expect(velocityRule.code).toBe('VELOCITY');
    expect(velocityRule.maxPoints).toBe(12);
  });

  it('scores nothing at or below 3x the rolling baseline', () => {
    expect(pointsAt(1.8)).toBeUndefined();
    expect(pointsAt(3)).toBeUndefined();
  });

  it('reproduces the reference curve at the DEMO_TAKEOVER_01 ratios', () => {
    expect(pointsAt(3.5)).toBe(3);
    expect(pointsAt(4.5)).toBe(9);
    expect(pointsAt(5.5)).toBe(12);
  });

  it('never exceeds 12 points', () => {
    expect(pointsAt(20)).toBe(12);
  });
});
