import { MODEL_JOB_TIER, type ModelJob, type ModelTier } from '@sentinel/domain';

export interface ModelTierSettings {
  readonly fastModel?: string;
  readonly deepModel?: string;
}

export class ModelNotConfiguredError extends Error {
  constructor(job: ModelJob, tier: ModelTier) {
    super(`No ${tier} model is configured for ${job}; set GEMINI_${tier}_MODEL`);
    this.name = 'ModelNotConfiguredError';
  }
}

/** Two tiers routed by job. Model identifiers come from configuration only, never from literals in code. */
export class ModelRouter {
  constructor(private readonly settings: ModelTierSettings) {}

  resolve(job: ModelJob): string {
    const tier = MODEL_JOB_TIER[job];
    const model = tier === 'FAST' ? this.settings.fastModel : this.settings.deepModel;
    if (!model) throw new ModelNotConfiguredError(job, tier);
    return model;
  }
}
