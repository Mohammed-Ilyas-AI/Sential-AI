import { RAPID_DRAIN_POLICY_VERSION, RULESET_VERSION, type DecisionRecord } from '@sentinel/domain';

/** Synthetic identifiers only: tokens that cannot be mistaken for real account numbers. */
export function decisionRecordFixture(overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    decisionId: 'dec-fixture-0001',
    tenantId: 'BANK_A',
    transactionId: 'txn-fixture-0001',
    idempotencyKey: 'idem-fixture-0001',
    decision: 'HOLD',
    riskScore: 95,
    policyCodes: ['RAPID_DRAIN'],
    reasonCodes: ['SG-RD-50_THRESHOLD_EXCEEDED'],
    assessmentId: 'asm-fixture-0001',
    rulesetVersion: RULESET_VERSION,
    policyVersion: RAPID_DRAIN_POLICY_VERSION,
    holdUntil: '2026-09-25T00:00:45.000Z',
    decidedAt: '2026-09-24T00:00:45.000Z',
    expiresAt: '2026-09-24T00:05:45.000Z',
    traceId: 'trace-fixture-0001',
    accountId: 'tok-acc-fixture-0001',
    accountReference: 'ACC-FIXTURE',
    institutionId: 'BANK_A',
    destinationInstitutionId: 'BANK_C',
    amount: 1_150_000,
    band: 'CRITICAL',
    occurredAt: '2026-09-24T00:00:45.000Z',
    assessment: {
      transactionId: 'txn-fixture-0001',
      score: 95,
      band: 'CRITICAL',
      contributions: [{ code: 'RAPID_DRAIN', label: 'Rapid account depletion', points: 30, detail: '65.4% of opening balance in 24h' }],
      drain: { balanceAtWindowStart: 5_200_000, outflow24h: 3_400_000, drainPct: 65.38, thresholdMet: true, excluded: false },
      evaluatedAt: '2026-09-24T00:00:45.000Z',
    },
    ...overrides,
  };
}
