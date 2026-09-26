import { MAX_RISK_SCORE, RULE_MAX_POINTS } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import { RISK_RULES } from './rule-registry.js';

describe('risk rule registry', () => {
  it('registers the seven documented rules exactly once', () => {
    const codes = RISK_RULES.map((rule) => rule.code);
    expect(new Set(codes)).toEqual(new Set(Object.keys(RULE_MAX_POINTS)));
    expect(codes).toHaveLength(7);
  });

  it('declares each rule maximum from the domain constants, summing to 100', () => {
    for (const rule of RISK_RULES) expect(rule.maxPoints).toBe(RULE_MAX_POINTS[rule.code]);
    expect(RISK_RULES.reduce((sum, rule) => sum + rule.maxPoints, 0)).toBe(MAX_RISK_SCORE);
  });
});
