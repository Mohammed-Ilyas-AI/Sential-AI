import { NotYetImplementedError, RULE_MAX_POINTS } from '@sentinel/domain';
import { AWAITING_BEHAVIOURAL_REFERENCE } from '../risk-engine/behavioural-reference.js';
import type { RiskRule } from '../risk-engine/risk-rule.js';

/**
 * Destination linked to flagged entities within two hops: 3 points each via confirmed links, 2 via
 * network tokens, 0 via correlated or unobserved links; capped at 9.
 */
export const entityLinkRule: RiskRule = {
  code: 'ENTITY_LINK',
  maxPoints: RULE_MAX_POINTS.ENTITY_LINK,
  evaluate() {
    throw new NotYetImplementedError('ENTITY_LINK rule', AWAITING_BEHAVIOURAL_REFERENCE);
  },
};
