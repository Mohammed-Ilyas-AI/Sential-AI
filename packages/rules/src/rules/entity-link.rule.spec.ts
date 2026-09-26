import { describe, expect, it } from 'vitest';
import { entityLinkRule } from './entity-link.rule.js';

describe('ENTITY_LINK rule', () => {
  it('declares its code and the documented cap of 9 points', () => {
    expect(entityLinkRule.code).toBe('ENTITY_LINK');
    expect(entityLinkRule.maxPoints).toBe(9);
  });

  it.todo('scores 3 per flagged entity within two hops via DIRECT or NETWORK_REFERENCE links');
  it.todo('scores 2 per flagged entity via NETWORK_TOKEN links');
  it.todo('scores nothing via CORRELATED or UNOBSERVED links, which are shown but never scored');
  it.todo('caps the total at 9 points');
});
