import type { IsoTimestamp } from '../time/iso-timestamp.js';

/**
 * Fast-tier prose over an assessment that already exists: a plain-English primary reason and the recommended
 * action. It explains the contributions; it never adds, removes or re-weights one. Cached by assessmentId.
 */
export interface RiskExplanation {
  readonly assessmentId: string;
  readonly primaryReason: string;
  readonly recommendedAction: string;
  readonly generatedAt: IsoTimestamp;
}
