import { describe, expect, it } from 'vitest';
import { velocityRule } from './velocity.rule.js';

describe('VELOCITY rule', () => {
  it('declares its code and the documented maximum of 12 points', () => {
    expect(velocityRule.code).toBe('VELOCITY');
    expect(velocityRule.maxPoints).toBe(12);
  });

  it.todo('scores nothing at or below 3x the account rolling baseline');
  it.todo('scales above 3x exactly as the HTML behavioural reference does');
  it.todo('never exceeds 12 points');
});
