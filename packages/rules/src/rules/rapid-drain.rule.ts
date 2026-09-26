import { NotYetImplementedError, RULE_MAX_POINTS } from '@sentinel/domain';
import { AWAITING_BEHAVIOURAL_REFERENCE } from '../risk-engine/behavioural-reference.js';
import type { RiskRule } from '../risk-engine/risk-rule.js';

/** Proportion of balance moved in 24h: 0 points at 25% drain, up to 30 at 50% and above. */
export const rapidDrainRule: RiskRule = {
  code: 'RAPID_DRAIN',
  maxPoints: RULE_MAX_POINTS.RAPID_DRAIN,
  evaluate() {
    throw new NotYetImplementedError('RAPID_DRAIN scoring curve', AWAITING_BEHAVIOURAL_REFERENCE);
  },
};
