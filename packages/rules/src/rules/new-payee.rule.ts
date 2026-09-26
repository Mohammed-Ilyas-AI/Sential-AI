import { RULE_LABELS, RULE_MAX_POINTS, RULE_PARAMETERS } from '@sentinel/domain';
import { formatAge } from '../risk-engine/contribution-formatting.js';
import type { RiskRule } from '../risk-engine/risk-rule.js';

const { fullPointsWithinHours, reducedPointsWithinHours, reducedPoints } = RULE_PARAMETERS.newPayee;

/** 16 points when the payee was added under 24 hours ago, 8 when under 7 days. */
export const newPayeeRule: RiskRule = {
  code: 'NEW_PAYEE',
  maxPoints: RULE_MAX_POINTS.NEW_PAYEE,
  evaluate(_transaction, _account, { features }) {
    const hours = features.payeeAgeHours;
    if (hours === null || hours >= reducedPointsWithinHours) return null;
    return {
      code: this.code,
      label: RULE_LABELS.NEW_PAYEE,
      points: hours < fullPointsWithinHours ? this.maxPoints : reducedPoints,
      detail: `${features.payeeToken ?? 'payee'}, added ${formatAge(hours)} ago`,
    };
  },
};
