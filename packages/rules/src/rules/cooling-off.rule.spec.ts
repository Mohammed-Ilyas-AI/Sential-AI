import { describe, expect, it } from 'vitest';
import { coolingOffRule } from './cooling-off.rule.js';

describe('COOLING_OFF rule', () => {
  it('declares its code and the documented 5 points', () => {
    expect(coolingOffRule.code).toBe('COOLING_OFF');
    expect(coolingOffRule.maxPoints).toBe(5);
  });

  it.todo('scores 5 while coolingOffUntil is in the future');
  it.todo('scores nothing once the cooling-off window has passed');
});
