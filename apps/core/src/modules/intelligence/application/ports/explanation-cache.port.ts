import type { RiskExplanation } from '@sentinel/domain';

/** Keyed by assessmentId and persisted, so a pre-warmed demo explanation survives any Cloud Run instance. */
export interface ExplanationCache {
  find(assessmentId: string): Promise<RiskExplanation | null>;
  store(explanation: RiskExplanation): Promise<void>;
}
