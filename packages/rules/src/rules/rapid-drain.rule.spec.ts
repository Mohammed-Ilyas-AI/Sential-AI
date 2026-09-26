import { describe, expect, it } from 'vitest';
import { accountFixture, drainFixture, transactionFixture, windowFixture } from '../testing/risk-inputs.fixture.js';
import { rapidDrainRule } from './rapid-drain.rule.js';

const pointsAt = (drainPct: number, isProtected = true): number | undefined =>
  rapidDrainRule.evaluate(
    transactionFixture(),
    accountFixture({ protected: isProtected }),
    windowFixture({ drain: drainFixture(drainPct) }),
  )?.points;

describe('RAPID_DRAIN rule', () => {
  it('declares its code and the documented maximum of 30 points', () => {
    expect(rapidDrainRule.code).toBe('RAPID_DRAIN');
    expect(rapidDrainRule.maxPoints).toBe(30);
  });

  it('scores nothing at or below 25% drain', () => {
    expect(pointsAt(20)).toBeUndefined();
    expect(pointsAt(25)).toBeUndefined();
  });

  it('scores the full 30 points at 50% drain and above', () => {
    expect(pointsAt(50)).toBe(30);
    expect(pointsAt(65.4)).toBe(30);
  });

  it('reproduces the reference curve at the DEMO_TAKEOVER_01 drains', () => {
    expect(pointsAt((1_530_000 / 5_200_000) * 100)).toBe(5);
    expect(pointsAt((2_250_000 / 5_200_000) * 100)).toBe(22);
  });

  it('never scores an unprotected account', () => {
    expect(pointsAt(65.4, false)).toBeUndefined();
  });

  it('describes the drain it measured', () => {
    const contribution = rapidDrainRule.evaluate(
      transactionFixture(),
      accountFixture(),
      windowFixture({ drain: drainFixture((3_400_000 / 5_200_000) * 100) }),
    );
    expect(contribution?.detail).toBe('65.4% of opening balance in 24h');
  });
});
