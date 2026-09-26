import { RULE_LABELS, RULE_MAX_POINTS, RULE_PARAMETERS } from '@sentinel/domain';
import { clampPoints } from '../risk-engine/contribution-formatting.js';
import type { RiskRule } from '../risk-engine/risk-rule.js';

const { baselineMultiple, pointsPerMultipleAboveBaseline } = RULE_PARAMETERS.velocity;

/** 0 points at or below 3x the rolling baseline; 6 points per multiple above it, capped at 12. */
export const velocityRule: RiskRule = {
  code: 'VELOCITY',
  maxPoints: RULE_MAX_POINTS.VELOCITY,
  evaluate(_transaction, _account, { features }) {
    const ratio = features.velocityRatio;
    if (ratio <= baselineMultiple) return null;
    const points = clampPoints(Math.round((ratio - baselineMultiple) * pointsPerMultipleAboveBaseline), this.maxPoints);
    if (points === 0) return null;
    return {
      code: this.code,
      label: RULE_LABELS.VELOCITY,
      points,
      detail: `${ratio.toFixed(1)}× account baseline`,
    };
  },
};
