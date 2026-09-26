import { RULE_LABELS, RULE_MAX_POINTS, RULE_PARAMETERS } from '@sentinel/domain';
import type { RiskRule } from '../risk-engine/risk-rule.js';

/** Binary: 5 points while a 12-hour cooling-off window is active. */
export const coolingOffRule: RiskRule = {
  code: 'COOLING_OFF',
  maxPoints: RULE_MAX_POINTS.COOLING_OFF,
  evaluate(_transaction, _account, { features }) {
    if (!features.coolingOffActive) return null;
    return {
      code: this.code,
      label: RULE_LABELS.COOLING_OFF,
      points: this.maxPoints,
      detail: `high-risk account change within ${RULE_PARAMETERS.coolingOff.windowHours}h`,
    };
  },
};
