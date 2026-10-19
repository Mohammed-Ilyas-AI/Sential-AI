export type ModelTier = 'FAST' | 'DEEP';

export type FastModelJob = 'RISK_EXPLANATION' | 'ALERT_ENRICHMENT' | 'ENTITY_SUMMARY' | 'NEXT_STEP_SUGGESTION' | 'CUSTOMER_OUTREACH';

export type DeepModelJob = 'CASE_SUMMARY' | 'EVIDENCE_CORRELATION' | 'CASE_REPORT_DRAFT';

export type ModelJob = FastModelJob | DeepModelJob;

/** Two tiers, routed by job (T§7). Model identifiers per tier are runtime configuration, never literals. */
export const MODEL_JOB_TIER: Readonly<Record<ModelJob, ModelTier>> = {
  RISK_EXPLANATION: 'FAST',
  ALERT_ENRICHMENT: 'FAST',
  ENTITY_SUMMARY: 'FAST',
  NEXT_STEP_SUGGESTION: 'FAST',
  CUSTOMER_OUTREACH: 'FAST',
  CASE_SUMMARY: 'DEEP',
  EVIDENCE_CORRELATION: 'DEEP',
  CASE_REPORT_DRAFT: 'DEEP',
};
