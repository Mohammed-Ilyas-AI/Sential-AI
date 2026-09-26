import { RULE_LABELS, RULE_MAX_POINTS, RULE_PARAMETERS } from '@sentinel/domain';
import { clampPoints } from '../risk-engine/contribution-formatting.js';
import type { RiskRule } from '../risk-engine/risk-rule.js';

const { zeroPointsAtDrainPercent, maxPointsAtDrainPercent } = RULE_PARAMETERS.rapidDrain;

/** Protected accounts only: 0 points at or below 25% drain, rising linearly to 30 at 50% and above. */
export const rapidDrainRule: RiskRule = {
  code: 'RAPID_DRAIN',
  maxPoints: RULE_MAX_POINTS.RAPID_DRAIN,
  evaluate(_transaction, account, { drain }) {
    if (!account.protected || drain.drainPct <= zeroPointsAtDrainPercent) return null;
    const scale = (drain.drainPct - zeroPointsAtDrainPercent) / (maxPointsAtDrainPercent - zeroPointsAtDrainPercent);
    const points = clampPoints(Math.round(scale * this.maxPoints), this.maxPoints);
    if (points === 0) return null;
    return {
      code: this.code,
      label: RULE_LABELS.RAPID_DRAIN,
      points,
      detail: `${drain.drainPct.toFixed(1)}% of opening balance in 24h`,
    };
  },
};
