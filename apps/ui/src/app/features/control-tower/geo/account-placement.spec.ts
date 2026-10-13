import { describe, expect, it } from 'vitest';
import { accountNodeFor } from './account-placement';
import { INSTITUTION_ANCHORS } from './geo-anchors';
import { isLand } from './land-mask';

describe('accountNodeFor', () => {
  const anchor = INSTITUTION_ANCHORS['BANK_A'] ?? { latitude: 51.5, longitude: -0.1 };

  it('is deterministic per account and lands on land near the bank', () => {
    const node = accountNodeFor('acct_demo_takeover', anchor);
    expect(accountNodeFor('acct_demo_takeover', anchor)).toEqual(node);
    expect(isLand(node.latitude, node.longitude)).toBe(true);
    expect(Math.abs(node.latitude - anchor.latitude)).toBeLessThanOrEqual(25);
  });

  it('spreads different accounts apart', () => {
    const nodes = ['acct_1', 'acct_2', 'acct_3', 'acct_4'].map((id) => accountNodeFor(id, anchor));
    expect(new Set(nodes.map((node) => `${node.latitude.toFixed(2)},${node.longitude.toFixed(2)}`)).size).toBe(4);
  });
});
