import { describe, expect, it } from 'vitest';
import { isLand, landDots } from './land-mask';

describe('land mask', () => {
  it('knows land from sea at the anchors the globe uses', () => {
    expect(isLand(51.5, -0.1)).toBe(true);
    expect(isLand(-26.2, 28)).toBe(true);
    expect(isLand(23, 12)).toBe(true);
    expect(isLand(30, -40)).toBe(false);
    expect(isLand(-40, -120)).toBe(false);
  });

  it('wraps longitude and clamps latitude', () => {
    expect(isLand(51.5, 359.9)).toBe(isLand(51.5, -0.1));
    expect(() => isLand(95, 0)).not.toThrow();
  });

  it('keeps roughly the share of the sphere that is land', () => {
    const share = landDots(4_000).length / 4_000;
    expect(share).toBeGreaterThan(0.24);
    expect(share).toBeLessThan(0.34);
  });
});
