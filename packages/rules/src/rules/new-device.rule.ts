import { RULE_LABELS, RULE_MAX_POINTS, RULE_PARAMETERS } from '@sentinel/domain';
import type { RiskRule } from '../risk-engine/risk-rule.js';

/** Binary: 21 points when the device was first seen under 24 hours ago. */
export const newDeviceRule: RiskRule = {
  code: 'NEW_DEVICE',
  maxPoints: RULE_MAX_POINTS.NEW_DEVICE,
  evaluate(_transaction, _account, { features }) {
    const hours = features.deviceAgeHours;
    if (hours === null || hours >= RULE_PARAMETERS.newDevice.firstSeenWithinHours) return null;
    return {
      code: this.code,
      label: RULE_LABELS.NEW_DEVICE,
      points: this.maxPoints,
      detail: `${features.deviceToken ?? 'device'}, first seen ${Math.max(1, Math.round(hours * 60))} min ago`,
    };
  },
};
