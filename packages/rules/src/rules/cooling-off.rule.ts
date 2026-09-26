import { NotYetImplementedError, RULE_MAX_POINTS } from '@sentinel/domain';
import { AWAITING_BEHAVIOURAL_REFERENCE } from '../risk-engine/behavioural-reference.js';
import type { RiskRule } from '../risk-engine/risk-rule.js';

/** Account within an active cooling-off window: binary, 5 points. */
export const coolingOffRule: RiskRule = {
  code: 'COOLING_OFF',
  maxPoints: RULE_MAX_POINTS.COOLING_OFF,
  evaluate() {
    throw new NotYetImplementedError('COOLING_OFF rule', AWAITING_BEHAVIOURAL_REFERENCE);
  },
};
