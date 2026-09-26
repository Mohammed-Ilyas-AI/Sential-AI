import { describe, expect, it } from 'vitest';
import { createSeededRandom } from './seeded-random.js';

const draw = (seed: number, count: number): number[] => {
  const random = createSeededRandom(seed);
  return Array.from({ length: count }, () => random.next());
};

describe('createSeededRandom', () => {
  it('replays the identical sequence for the same seed', () => {
    expect(draw(1_024, 100)).toEqual(draw(1_024, 100));
  });

  it('produces a different sequence for a different seed', () => {
    expect(draw(1_024, 10)).not.toEqual(draw(1_025, 10));
  });

  it('draws only values in [0, 1)', () => {
    for (const value of draw(7, 1_000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
