import { NotYetImplementedError, RULE_MAX_POINTS } from '@sentinel/domain';
import { AWAITING_BEHAVIOURAL_REFERENCE } from '../risk-engine/behavioural-reference.js';
import type { RiskRule } from '../risk-engine/risk-rule.js';

/** Payee not in knownPayeeIds: 16 points if added under 24 hours ago, 8 if under 7 days. */
export const newPayeeRule: RiskRule = {
  code: 'NEW_PAYEE',
  maxPoints: RULE_MAX_POINTS.NEW_PAYEE,
  evaluate() {
    throw new NotYetImplementedError('NEW_PAYEE rule', AWAITING_BEHAVIOURAL_REFERENCE);
  },
};
