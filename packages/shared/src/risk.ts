export type RiskBand = 'low' | 'elevated' | 'high' | 'critical';

export type SignalCode =
  | 'NEW_PAYEE_HIGH_VALUE'
  | 'UNUSUAL_HOUR'
  | 'VELOCITY_BURST'
  | 'AMOUNT_DEVIATION'
  | 'DEVICE_CHANGE'
  | 'CROSS_BORDER_FIRST_TIME';

/** One rule firing. Carries its own reason so the UI never maps codes to English. */
export interface RiskSignal {
  readonly code: SignalCode;
  /** Contribution to the score, 0-100. */
  readonly weight: number;
  readonly reason: string;
  readonly evidence: Readonly<Record<string, string | number | boolean>>;
}

export interface RiskAssessment {
  readonly transactionId: string;
  /** 0-100. */
  readonly score: number;
  readonly band: RiskBand;
  readonly signals: readonly RiskSignal[];
  /** Gemini narrative; null while generating. */
  readonly explanation: string | null;
  readonly assessedAt: string;
}
