import type { EvidenceBundle, ModelJob } from '@sentinel/domain';

/**
 * The only way the intelligence path reaches a language model. The response is untrusted JSON until the
 * application validators have checked its schema and its sourceFields.
 */
export interface ModelGateway {
  generate(job: ModelJob, evidence: EvidenceBundle): Promise<unknown>;
}
