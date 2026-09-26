import { describe, expect, it } from 'vitest';
import { accountFixture, transactionFixture, windowFixture } from '../testing/risk-inputs.fixture.js';
import { newPayeeRule } from './new-payee.rule.js';

const pointsAt = (payeeAgeHours: number | null): number | undefined =>
  newPayeeRule.evaluate(transactionFixture(), accountFixture(), windowFixture({ features: { payeeAgeHours } }))?.points;

describe('NEW_PAYEE rule', () => {
  it('declares its code and the documented maximum of 16 points', () => {
    expect(newPayeeRule.code).toBe('NEW_PAYEE');
    expect(newPayeeRule.maxPoints).toBe(16);
  });

  it('scores 16 for a payee added under 24 hours ago', () => {
    expect(pointsAt(0.011)).toBe(16);
    expect(pointsAt(23.9)).toBe(16);
  });

  it('scores 8 for a payee added between 24 hours and 7 days ago', () => {
    expect(pointsAt(24)).toBe(8);
    expect(pointsAt(167.9)).toBe(8);
  });

  it('scores nothing at 7 days or for an established payee', () => {
    expect(pointsAt(168)).toBeUndefined();
    expect(pointsAt(null)).toBeUndefined();
  });
});
