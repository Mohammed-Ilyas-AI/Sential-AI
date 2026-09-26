import { CASE_SUMMARY_EVIDENCE_MAX_ITEMS, CASE_SUMMARY_HYPOTHESIS_MAX_CHARS } from '@sentinel/domain';

/** Structured-output schema for the deep-tier CaseSummary; mirrors the domain contract exactly. */
export const CASE_SUMMARY_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['hypothesis', 'confidence', 'evidence', 'recommendedActions', 'escalate'],
  properties: {
    hypothesis: { type: 'string', maxLength: CASE_SUMMARY_HYPOTHESIS_MAX_CHARS },
    confidence: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
    evidence: {
      type: 'array',
      maxItems: CASE_SUMMARY_EVIDENCE_MAX_ITEMS,
      items: {
        type: 'object',
        required: ['claim', 'sourceField', 'value'],
        properties: {
          claim: { type: 'string' },
          sourceField: { type: 'string' },
          value: { type: 'string' },
        },
      },
    },
    recommendedActions: { type: 'array', items: { type: 'string' } },
    escalate: { type: 'boolean' },
  },
} as const;
