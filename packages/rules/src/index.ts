export type { RiskRule } from './risk-engine/risk-rule.js';
export { RISK_RULES } from './risk-engine/rule-registry.js';
export { assess, type AssessRisk } from './risk-engine/assess.js';
export { bandFor, type BandForScore } from './risk-engine/band-for.js';

export { rapidDrainRule } from './rules/rapid-drain.rule.js';
export { newDeviceRule } from './rules/new-device.rule.js';
export { newPayeeRule } from './rules/new-payee.rule.js';
export { velocityRule } from './rules/velocity.rule.js';
export { entityLinkRule } from './rules/entity-link.rule.js';
export { behaviourDeviationRule } from './rules/behaviour-deviation.rule.js';
export { coolingOffRule } from './rules/cooling-off.rule.js';

export { drainGate, type DrainGate } from './policy-gate/drain-gate.js';
export { drainExclusionFor, type DrainExclusionFor } from './policy-gate/drain-exclusions.js';
