import { NotYetImplementedError, RULE_MAX_POINTS } from '@sentinel/domain';
import { AWAITING_BEHAVIOURAL_REFERENCE } from '../risk-engine/behavioural-reference.js';
import type { RiskRule } from '../risk-engine/risk-rule.js';

/** Transactions per minute against the account baseline: scales above 3x the rolling baseline, up to 12 points. */
export const velocityRule: RiskRule = {
  code: 'VELOCITY',
  maxPoints: RULE_MAX_POINTS.VELOCITY,
  evaluate() {
    throw new NotYetImplementedError('VELOCITY scoring curve', AWAITING_BEHAVIOURAL_REFERENCE);
  },
};
