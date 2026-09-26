import type { RapidDrainPolicy } from '../policy/rapid-drain-policy.js';

/** S$50,000 in cents. */
export const PROTECTED_BALANCE_MINOR = 5_000_000;

/** Compared strictly: more than 50% of the balance at window start. */
export const RAPID_DRAIN_GATE_PERCENT = 50;

export const ROLLING_WINDOW_HOURS = 24;

export const POLICY_HOLD_HOURS = 24;

/** Friction on capability after a high-risk account event; a separate mechanism from the drain gate. */
export const COOLING_OFF_HOURS = 12;

export const RAPID_DRAIN_RULE_ID = 'SG-RD-50';

export const RAPID_DRAIN_POLICY_VERSION = 'SG-RD-1.0';

/** Demo only, labelled "demo time x3600" in the UI: 24 hours reads as 24 seconds. */
export const DEMO_TIME_COMPRESSION_FACTOR = 3600;

export const DEFAULT_RAPID_DRAIN_POLICY: RapidDrainPolicy = {
  policyVersion: RAPID_DRAIN_POLICY_VERSION,
  protectedBalance: PROTECTED_BALANCE_MINOR,
  gatePercent: RAPID_DRAIN_GATE_PERCENT,
  windowHours: ROLLING_WINDOW_HOURS,
  holdHours: POLICY_HOLD_HOURS,
};
