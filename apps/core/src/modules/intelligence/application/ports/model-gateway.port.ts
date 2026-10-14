import type { EvidenceBundle, ModelJob } from '@sentinel/domain';

/**
 * The only way the intelligence path reaches a language model. The response is untrusted output until the
 * application validators have checked its schema and its sourceFields.
 */
export interface ModelGateway {
  generate(job: ModelJob, evidence: EvidenceBundle): Promise<unknown>;
}

/** NOT_CONFIGURED is not retried: no model ID is set for the job's tier. UNAVAILABLE covers timeouts and errors. */
export class ModelUnavailableError extends Error {
  constructor(
    readonly reason: 'NOT_CONFIGURED' | 'UNAVAILABLE',
    message: string,
  ) {
    super(message);
    this.name = 'ModelUnavailableError';
  }
}
