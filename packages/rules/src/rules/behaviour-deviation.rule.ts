import { RULE_LABELS, RULE_MAX_POINTS } from '@sentinel/domain';
import { clampPoints, formatWholeDollars } from '../risk-engine/contribution-formatting.js';
import type { RiskRule } from '../risk-engine/risk-rule.js';

/** 0 points at or below the 95th-percentile amount; the excess over it, as a share of it, times 7, capped at 7. */
export const behaviourDeviationRule: RiskRule = {
  code: 'BEHAVIOUR_DEV',
  maxPoints: RULE_MAX_POINTS.BEHAVIOUR_DEV,
  evaluate(transaction, _account, { features }) {
    const p95 = features.amountP95;
    if (p95 <= 0 || transaction.amount <= p95) return null;
    const points = clampPoints(Math.round(((transaction.amount - p95) / p95) * this.maxPoints), this.maxPoints);
    if (points === 0) return null;
    return {
      code: this.code,
      label: RULE_LABELS.BEHAVIOUR_DEV,
      points,
      detail: `${formatWholeDollars(transaction.amount)}, above the 95th percentile of ${formatWholeDollars(p95)}`,
    };
  },
};
