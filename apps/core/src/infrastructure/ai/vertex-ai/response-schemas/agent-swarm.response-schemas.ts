/**
 * Response schemas for a future model-backed swarm (instructions versioned, not wired: M§8.8). They mirror the
 * deterministic findings in @sentinel/domain field for field, so the contract cannot drift. No agent may return a
 * recommendation to release a hold.
 */
export const ATO_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    isTakeoverLikely: { type: 'boolean' },
    deviceRisk: { type: 'string', enum: ['KNOWN', 'SUSPICIOUS', 'UNSEEN_COMPROMISED'] },
    authenticationLineage: { type: 'string' },
    atoSignalPoints: { type: 'number' },
  },
  required: ['isTakeoverLikely', 'deviceRisk', 'authenticationLineage', 'atoSignalPoints'],
  additionalProperties: false,
} as const;

export const BENEFICIARY_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    payeeRiskTier: { type: 'string', enum: ['BENIGN_BILLER', 'ESTABLISHED', 'NEW_HIGH_RISK', 'FLAGGED_NEIGHBOURHOOD'] },
    dormantPayeeActivated: { type: 'boolean' },
    counterpartyAssessment: { type: 'string' },
  },
  required: ['payeeRiskTier', 'dormantPayeeActivated', 'counterpartyAssessment'],
  additionalProperties: false,
} as const;

export const SCAM_INTENT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    scamTypology: { type: 'string', enum: ['ACCOUNT_TAKEOVER', 'CREDENTIAL_REPLAY', 'MULE_FORWARDING', 'SMURFING', 'UNCLASSIFIED'] },
    outflowPressure: { type: 'string', enum: ['LOW', 'MEDIUM', 'ACUTE'] },
    behavioralAnomalySummary: { type: 'string' },
  },
  required: ['scamTypology', 'outflowPressure', 'behavioralAnomalySummary'],
  additionalProperties: false,
} as const;

export const MULE_TRACE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    observedHops: { type: 'number' },
    flaggedNeighbourhood: { type: 'boolean' },
    pathEntities: { type: 'array', items: { type: 'string' } },
    observabilityStopReason: { type: 'string' },
  },
  required: ['observedHops', 'flaggedNeighbourhood', 'pathEntities', 'observabilityStopReason'],
  additionalProperties: false,
} as const;

export const CUSTOMER_VERIFICATION_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    proposedChannel: { type: 'string', enum: ['AUTOMATED_CALL', 'SECURE_PUSH', 'EMAIL'] },
    recommendedImmediateAction: { type: 'string', enum: ['KILL_SWITCH', 'RETRY_CONTACT', 'MONITOR'] },
    verificationScript: { type: 'string' },
  },
  required: ['proposedChannel', 'recommendedImmediateAction', 'verificationScript'],
  additionalProperties: false,
} as const;

export const CASE_REPORTING_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    reportVersion: { type: 'number' },
    executiveSummary: { type: 'string' },
    draftSummary: { type: 'string' },
    readyForAnalystReview: { type: 'boolean' },
  },
  required: ['reportVersion', 'executiveSummary', 'draftSummary', 'readyForAnalystReview'],
  additionalProperties: false,
} as const;
