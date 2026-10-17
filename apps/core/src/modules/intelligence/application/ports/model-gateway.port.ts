import type { EvidenceBundle, ModelJob } from '@sentinel/domain';

/**
 * The only way the intelligence path reaches a language model. The response is untrusted output until the
 * application validators have checked its schema and its sourceFields.
 */
export interface ModelGateway {
  generate(job: ModelJob, evidence: EvidenceBundle): Promise<unknown>;
}

/**
 * NOT_CONFIGURED (no model ID for the job's tier) and CREDENTIALS (no application default credentials) are not
 * retried: a second call cannot succeed. UNAVAILABLE covers timeouts, HTTP errors and truncated responses.
 */
export class ModelUnavailableError extends Error {
  constructor(
    readonly reason: 'NOT_CONFIGURED' | 'CREDENTIALS' | 'UNAVAILABLE',
    message: string,
  ) {
    super(message);
    this.name = 'ModelUnavailableError';
  }
}
