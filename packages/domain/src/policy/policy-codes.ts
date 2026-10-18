/** RAPID_DRAIN is the SG-RD-50 gate and its cascade; KILL_SWITCH is the analyst-initiated account hold (M§5.3). */
export type PolicyCode = 'RAPID_DRAIN' | 'KILL_SWITCH';

/**
 * Reason codes on a DecisionResponse. The first three are the HTML reference's; EXCLUDED marks a bypass;
 * HOLD_CASCADE marks an eligible outflow held because an earlier transfer met the threshold (T§4).
 */
export const DECISION_REASON = {
  thresholdExceeded: 'SG-RD-50_THRESHOLD_EXCEEDED',
  gateNotMet: 'SG-RD-50_GATE_NOT_MET',
  notProtected: 'NOT_PROTECTED_BALANCE',
  excluded: 'SG-RD-50_EXCLUDED',
  holdCascade: 'SG-RD-50_HOLD_CASCADE',
  /** Held because an analyst activated the account's kill switch; released only after customer verification. */
  killSwitch: 'ANALYST_KILL_SWITCH',
} as const;

export type DecisionReasonCode = (typeof DECISION_REASON)[keyof typeof DECISION_REASON];
