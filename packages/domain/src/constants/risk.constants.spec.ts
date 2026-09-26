import { describe, expect, it } from 'vitest';
import { ENTITY_LINK_POINTS, MAX_RISK_SCORE, RISK_BAND_LOWER_BOUNDS, RULE_MAX_POINTS } from './risk.constants.js';

describe('documented risk constants (T§3)', () => {
  it('rule maxima sum to the maximum score of 100', () => {
    const total = Object.values(RULE_MAX_POINTS).reduce((sum, points) => sum + points, 0);
    expect(total).toBe(MAX_RISK_SCORE);
  });

  it('orders bands from LOW to CRITICAL within 0..100', () => {
    const bounds = [
      RISK_BAND_LOWER_BOUNDS.LOW,
      RISK_BAND_LOWER_BOUNDS.ELEVATED,
      RISK_BAND_LOWER_BOUNDS.HIGH,
      RISK_BAND_LOWER_BOUNDS.CRITICAL,
    ];
    expect(bounds).toEqual([...bounds].sort((a, b) => a - b));
    expect(bounds[0]).toBe(0);
    expect(bounds.at(-1)).toBeLessThanOrEqual(MAX_RISK_SCORE);
  });

  it('never scores weak links, and three confirmed links reach the ENTITY_LINK cap', () => {
    expect(ENTITY_LINK_POINTS.CANDIDATE).toBe(0);
    expect(ENTITY_LINK_POINTS.NONE).toBe(0);
    expect(ENTITY_LINK_POINTS.CONFIRMED * 3).toBe(RULE_MAX_POINTS.ENTITY_LINK);
  });
});
