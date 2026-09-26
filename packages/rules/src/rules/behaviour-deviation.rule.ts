import { NotYetImplementedError, RULE_MAX_POINTS } from '@sentinel/domain';
import { AWAITING_BEHAVIOURAL_REFERENCE } from '../risk-engine/behavioural-reference.js';
import type { RiskRule } from '../risk-engine/risk-rule.js';

/** Amount against the account's 90-day distribution: scales above the 95th percentile, up to 7 points. */
export const behaviourDeviationRule: RiskRule = {
  code: 'BEHAVIOUR_DEV',
  maxPoints: RULE_MAX_POINTS.BEHAVIOUR_DEV,
  evaluate() {
    throw new NotYetImplementedError('BEHAVIOUR_DEV scoring curve', AWAITING_BEHAVIOURAL_REFERENCE);
  },
};
