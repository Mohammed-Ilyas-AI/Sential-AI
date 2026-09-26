import type { DecisionRecord, DecisionResponse } from '@sentinel/domain';

/** The contract the bank sees: exactly the DecisionResponse fields, never the stored extras. */
export function toDecisionResponse(record: DecisionRecord): DecisionResponse {
  return {
    decisionId: record.decisionId,
    tenantId: record.tenantId,
    transactionId: record.transactionId,
    idempotencyKey: record.idempotencyKey,
    decision: record.decision,
    riskScore: record.riskScore,
    policyCodes: record.policyCodes,
    reasonCodes: record.reasonCodes,
    assessmentId: record.assessmentId,
    rulesetVersion: record.rulesetVersion,
    policyVersion: record.policyVersion,
    ...(record.caseId ? { caseId: record.caseId } : {}),
    ...(record.holdUntil ? { holdUntil: record.holdUntil } : {}),
    decidedAt: record.decidedAt,
    expiresAt: record.expiresAt,
    traceId: record.traceId,
  };
}
