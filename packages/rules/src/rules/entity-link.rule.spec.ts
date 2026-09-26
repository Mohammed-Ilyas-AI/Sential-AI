import type { EdgeLinkage } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import { accountFixture, transactionFixture, windowFixture } from '../testing/risk-inputs.fixture.js';
import { entityLinkRule } from './entity-link.rule.js';

const evaluate = (flaggedLinks: readonly EdgeLinkage[]) =>
  entityLinkRule.evaluate(transactionFixture(), accountFixture(), windowFixture({ features: { flaggedLinks } }));

describe('ENTITY_LINK rule', () => {
  it('declares its code and the documented cap of 9 points', () => {
    expect(entityLinkRule.code).toBe('ENTITY_LINK');
    expect(entityLinkRule.maxPoints).toBe(9);
  });

  it('scores 3 per flagged entity via DIRECT or NETWORK_REFERENCE links', () => {
    expect(evaluate(['DIRECT'])?.points).toBe(3);
    expect(evaluate(['NETWORK_REFERENCE', 'DIRECT'])?.points).toBe(6);
  });

  it('scores 2 per flagged entity via NETWORK_TOKEN links', () => {
    expect(evaluate(['NETWORK_TOKEN'])?.points).toBe(2);
  });

  it('never scores CORRELATED or UNOBSERVED links', () => {
    expect(evaluate(['CORRELATED', 'UNOBSERVED'])).toBeNull();
    expect(evaluate([])).toBeNull();
  });

  it('caps at 9 for the DEMO_TAKEOVER_01 final payee', () => {
    const contribution = evaluate(['NETWORK_REFERENCE', 'NETWORK_REFERENCE', 'NETWORK_REFERENCE', 'NETWORK_TOKEN', 'CORRELATED']);
    expect(contribution?.points).toBe(9);
    expect(contribution?.detail).toBe('3 flagged via confirmed links, 1 via network device token, 1 candidate not scored');
  });
});
