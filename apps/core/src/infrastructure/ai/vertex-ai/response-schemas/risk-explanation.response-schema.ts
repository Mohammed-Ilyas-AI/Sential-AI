/** Structured-output schema for the fast-tier RiskExplanation prose; the server adds assessmentId and time. */
export const RISK_EXPLANATION_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['primaryReason', 'recommendedAction'],
  properties: {
    primaryReason: { type: 'string', maxLength: 600 },
    recommendedAction: { type: 'string', maxLength: 600 },
  },
} as const;
