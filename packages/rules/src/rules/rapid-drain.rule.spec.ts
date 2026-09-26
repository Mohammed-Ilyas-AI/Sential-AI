import { describe, expect, it } from 'vitest';
import { rapidDrainRule } from './rapid-drain.rule.js';

describe('RAPID_DRAIN rule', () => {
  it('declares its code and the documented maximum of 30 points', () => {
    expect(rapidDrainRule.code).toBe('RAPID_DRAIN');
    expect(rapidDrainRule.maxPoints).toBe(30);
  });

  it.todo('scores 0 at or below 25% drain');
  it.todo('scores the full 30 points at 50% drain and above');
  it.todo('scales between 25% and 50% exactly as the HTML behavioural reference does');
});
