import { describe, expect, it } from 'vitest';
import { accountFixture, transactionFixture, windowFixture } from '../testing/risk-inputs.fixture.js';
import { coolingOffRule } from './cooling-off.rule.js';

const pointsWhen = (coolingOffActive: boolean): number | undefined =>
  coolingOffRule.evaluate(transactionFixture(), accountFixture(), windowFixture({ features: { coolingOffActive } }))?.points;

describe('COOLING_OFF rule', () => {
  it('declares its code and the documented 5 points', () => {
    expect(coolingOffRule.code).toBe('COOLING_OFF');
    expect(coolingOffRule.maxPoints).toBe(5);
  });

  it('scores 5 while a cooling-off window is active', () => {
    expect(pointsWhen(true)).toBe(5);
  });

  it('scores nothing once the window has passed', () => {
    expect(pointsWhen(false)).toBeUndefined();
  });
});
