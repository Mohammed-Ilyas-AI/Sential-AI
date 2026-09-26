import { DEMO_TAKEOVER_01 } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import { MinorUnitsCurrencyPipe } from './minor-units-currency-pipe';

describe('MinorUnitsCurrencyPipe', () => {
  const pipe = new MinorUnitsCurrencyPipe();

  it('formats the demo figures as the documents print them', () => {
    expect(pipe.transform(DEMO_TAKEOVER_01.openingBalance)).toBe('S$52,000.00');
    expect(pipe.transform(DEMO_TAKEOVER_01.totalMovedInWindow)).toBe('S$34,000.00');
  });

  it('keeps cents exact', () => {
    expect(pipe.transform(5)).toBe('S$0.05');
    expect(pipe.transform(123_456)).toBe('S$1,234.56');
  });

  it('signs negative amounts', () => {
    expect(pipe.transform(-250)).toBe('-S$2.50');
  });
});
