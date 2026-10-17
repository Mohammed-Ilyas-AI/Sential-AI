import type { EvidenceBundle, ModelJob } from '@sentinel/domain';

/**
 * The only way the intelligence path reaches a language model. The response is untrusted output until the
 * application validators have checked its schema and its sourceFields.
 */
export interface ModelGateway {
  generate(job: ModelJob, evidence: EvidenceBundle): Promise<unknown>;
}

/**
 * Only TRANSIENT is retried (once): a network failure, 429 or 5xx. The rest cannot succeed on an identical call:
 * NOT_CONFIGURED (no model ID for the tier), CREDENTIALS (no application default credentials), REJECTED (any
 * other 4xx) and TIMED_OUT (no answer before the platform ceiling; repeating the same expensive call would only
 * bill twice for the same delay).
 */
export type ModelUnavailableReason = 'NOT_CONFIGURED' | 'CREDENTIALS' | 'TIMED_OUT' | 'REJECTED' | 'TRANSIENT';

export class ModelUnavailableError extends Error {
  constructor(
    readonly reason: ModelUnavailableReason,
    message: string,
  ) {
    super(message);
    this.name = 'ModelUnavailableError';
  }
}
