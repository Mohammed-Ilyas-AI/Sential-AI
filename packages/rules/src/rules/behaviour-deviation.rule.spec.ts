import { describe, expect, it } from 'vitest';
import { behaviourDeviationRule } from './behaviour-deviation.rule.js';

describe('BEHAVIOUR_DEV rule', () => {
  it('declares its code and the documented maximum of 7 points', () => {
    expect(behaviourDeviationRule.code).toBe('BEHAVIOUR_DEV');
    expect(behaviourDeviationRule.maxPoints).toBe(7);
  });

  it.todo('scores nothing at or below the 95th percentile of the 90-day amount distribution');
  it.todo('scales above the 95th percentile exactly as the HTML behavioural reference does');
  it.todo('never exceeds 7 points');
});
