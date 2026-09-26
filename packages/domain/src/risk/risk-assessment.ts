import type { DrainState } from '../policy/drain-state.js';
import type { IsoTimestamp } from '../time/iso-timestamp.js';
import type { Contribution } from './contribution.js';

export type RiskBand = 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

/** Advisory. The policy gate, not the score, decides. */
export interface RiskAssessment {
  readonly transactionId: string;
  /** 0..100 and always the sum of contributions[].points; the UI never recomputes it. */
  readonly score: number;
  readonly band: RiskBand;
  readonly contributions: readonly Contribution[];
  readonly drain: DrainState;
  readonly evaluatedAt: IsoTimestamp;
}
