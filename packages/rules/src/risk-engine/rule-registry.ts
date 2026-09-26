import { behaviourDeviationRule } from '../rules/behaviour-deviation.rule.js';
import { coolingOffRule } from '../rules/cooling-off.rule.js';
import { entityLinkRule } from '../rules/entity-link.rule.js';
import { newDeviceRule } from '../rules/new-device.rule.js';
import { newPayeeRule } from '../rules/new-payee.rule.js';
import { rapidDrainRule } from '../rules/rapid-drain.rule.js';
import { velocityRule } from '../rules/velocity.rule.js';
import type { RiskRule } from './risk-rule.js';

export const RISK_RULES: readonly RiskRule[] = [
  rapidDrainRule,
  newDeviceRule,
  newPayeeRule,
  velocityRule,
  entityLinkRule,
  behaviourDeviationRule,
  coolingOffRule,
];
