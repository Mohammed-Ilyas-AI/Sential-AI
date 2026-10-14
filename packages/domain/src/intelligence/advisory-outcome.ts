import type { EvidenceBundle } from './evidence-bundle.js';

/** Why the analyst sees the deterministic attribution alone (T§7). The protection is never affected. */
export type AdvisoryFallbackReason = 'MODEL_NOT_CONFIGURED' | 'MODEL_UNAVAILABLE' | 'INVALID_RESPONSE';

/**
 * The result of one advisory request. GENERATED and CACHED carry schema-validated, grounded output; FALLBACK
 * carries none, and the UI renders the contributions[] the rule engine already wrote.
 */
export type AdvisoryOutcome<TAdvisory> =
  | {
      readonly status: 'GENERATED' | 'CACHED';
      readonly advisory: TAdvisory;
      /** Model calls made for this request: 0 when cached, at most 1 + MODEL_RESPONSE_MAX_RETRIES. */
      readonly attempts: number;
      /** Claims removed because their sourceField does not exist in the bundle that was sent. */
      readonly droppedClaims: number;
    }
  | {
      readonly status: 'FALLBACK';
      readonly advisory: null;
      readonly reason: AdvisoryFallbackReason;
      readonly attempts: number;
    };

/** What the investigation workspace opens with: the bundle exactly as Gemini would receive it. */
export interface InvestigationEvidence {
  readonly assessmentId: string;
  readonly evidence: EvidenceBundle;
}
