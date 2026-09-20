export type ControlCode = 'RAPID_DRAIN';
export type PolicyOutcome = 'allow' | 'hold' | 'challenge';

export interface RapidDrainThresholds {
  readonly windowMinutes: number;
  readonly balancePct: number;
  readonly minAmountMinor: number;
}

/**
 * Kept separate from RiskAssessment: scoring says how risky something looks,
 * policy says what the bank is obliged to do about it.
 */
export interface PolicyDecision {
  readonly transactionId: string;
  readonly control: ControlCode;
  readonly outcome: PolicyOutcome;
  /** Thresholds in force at decision time, recorded so later config changes cannot rewrite history. */
  readonly thresholds: RapidDrainThresholds;
  readonly decidedAt: string;
}
