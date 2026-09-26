import { describe, it } from 'vitest';

describe('assess()', () => {
  it.todo('produces a score equal to the sum of contribution points');
  it.todo('omits rules that return null or zero points');
  it.todo('sorts contributions by points, highest first');
  it.todo('returns the same assessment for the same inputs, every time');
});

describe('bandFor()', () => {
  it.todo('maps 39 to LOW and 40 to ELEVATED');
  it.todo('maps 64 to ELEVATED and 65 to HIGH');
  it.todo('maps 84 to HIGH and 85 to CRITICAL');
});
