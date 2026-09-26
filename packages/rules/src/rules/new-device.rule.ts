import { NotYetImplementedError, RULE_MAX_POINTS } from '@sentinel/domain';
import { AWAITING_BEHAVIOURAL_REFERENCE } from '../risk-engine/behavioural-reference.js';
import type { RiskRule } from '../risk-engine/risk-rule.js';

/** Device not in knownDeviceIds: binary, 21 points if first seen under 24 hours ago. */
export const newDeviceRule: RiskRule = {
  code: 'NEW_DEVICE',
  maxPoints: RULE_MAX_POINTS.NEW_DEVICE,
  evaluate() {
    throw new NotYetImplementedError('NEW_DEVICE rule', AWAITING_BEHAVIOURAL_REFERENCE);
  },
};
