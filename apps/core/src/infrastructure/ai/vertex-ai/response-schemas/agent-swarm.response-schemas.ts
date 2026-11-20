export const ATO_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    isTakeoverLikely: { type: 'boolean' },
    deviceRisk: { type: 'string', enum: ['KNOWN', 'SUSPICIOUS', 'UNSEEN_COMPROMISED'] },
    authenticationLineage: { type: 'string' },
    atoConfidenceScore: { type: 'number' },
  },
  required: ['isTakeoverLikely', 'deviceRisk', 'authenticationLineage', 'atoConfidenceScore'],
  additionalProperties: false,
} as const;

export const BENEFICIARY_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    payeeRiskTier: { type: 'string', enum: ['BENIGN_BILLER', 'ESTABLISHED', 'NEW_HIGH_RISK', 'KNOWN_MULE'] },
    dormantPayeeActivated: { type: 'boolean' },
    counterpartyAssessment: { type: 'string' },
  },
  required: ['payeeRiskTier', 'dormantPayeeActivated', 'counterpartyAssessment'],
  additionalProperties: false,
} as const;

export const SCAM_INTENT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    scamTypology: { type: 'string', enum: ['GOVERNMENT_IMPERSONATION', 'INVESTMENT_SCAM', 'JOB_SCAM', 'UNKNOWN_DRAIN'] },
    coercionIndex: { type: 'string', enum: ['LOW', 'MEDIUM', 'ACUTE_COERCION'] },
    behavioralAnomalySummary: { type: 'string' },
  },
  required: ['scamTypology', 'coercionIndex', 'behavioralAnomalySummary'],
  additionalProperties: false,
} as const;

export const MULE_TRACE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    observedHops: { type: 'number' },
    identifiedMuleRing: { type: 'boolean' },
    pathEntities: { type: 'array', items: { type: 'string' } },
    observabilityStopReason: { type: 'string' },
  },
  required: ['observedHops', 'identifiedMuleRing', 'pathEntities', 'observabilityStopReason'],
  additionalProperties: false,
} as const;

export const CUSTOMER_VERIFICATION_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    channelUsed: { type: 'string', enum: ['AUTOMATED_CALL', 'SECURE_PUSH', 'EMAIL'] },
    callOutcome: { type: 'string', enum: ['NO_ANSWER', 'VERIFIED_GENUINE', 'COERCION_CONFIRMED', 'CALL_DROPPED'] },
    recommendedImmediateAction: { type: 'string', enum: ['KILL_SWITCH', 'RELEASE_HOLD', 'RETRY_CONTACT'] },
    verificationScript: { type: 'string' },
  },
  required: ['channelUsed', 'callOutcome', 'recommendedImmediateAction', 'verificationScript'],
  additionalProperties: false,
} as const;

export const CASE_REPORTING_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    reportVersion: { type: 'number' },
    executiveSummary: { type: 'string' },
    cadReportDossier: { type: 'string' },
    isReadyForSignOff: { type: 'boolean' },
  },
  required: ['reportVersion', 'executiveSummary', 'cadReportDossier', 'isReadyForSignOff'],
  additionalProperties: false,
} as const;

