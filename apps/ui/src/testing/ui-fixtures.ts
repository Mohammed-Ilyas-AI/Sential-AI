import {
  DECISION_REASON,
  DEFAULT_RAPID_DRAIN_POLICY,
  DEMO_TAKEOVER_01,
  RULE_LABELS,
  type Alert,
  type Contribution,
  type DecisionRecord,
  type Intervention,
  type RiskRuleCode,
} from '@sentinel/domain';

/** Synthetic fixtures for UI specs only; the numbers are DEMO_TAKEOVER_01's, never a real account. */
const DEMO_ACCOUNT_ID = 'acct_demo_takeover';

function contributionsFrom(points: Partial<Record<RiskRuleCode, number>>): readonly Contribution[] {
  return Object.entries(points).map(([code, value]) => ({
    code: code as RiskRuleCode,
    label: RULE_LABELS[code as RiskRuleCode],
    points: value ?? 0,
    detail: `${code} fired`,
  }));
}

export function decisionRecord(overrides: Partial<DecisionRecord> & { readonly transactionId: string }): DecisionRecord {
  const { transactionId } = overrides;
  const base: DecisionRecord = {
    decisionId: `dec_${transactionId}`,
    tenantId: DEMO_TAKEOVER_01.institutionId,
    transactionId,
    idempotencyKey: `idem_${transactionId}`,
    decision: 'ALLOW',
    riskScore: 5,
    policyCodes: [],
    reasonCodes: [DECISION_REASON.gateNotMet],
    assessmentId: `asm_${transactionId}`,
    rulesetVersion: 'rules-test',
    policyVersion: DEFAULT_RAPID_DRAIN_POLICY.policyVersion,
    decidedAt: '2026-09-24T01:00:00.000Z',
    expiresAt: '2026-09-24T01:05:00.000Z',
    traceId: `trace_${transactionId}`,
    accountId: 'acct_other',
    institutionId: 'BANK_B',
    destinationInstitutionId: 'BANK_A',
    amount: 12_000,
    band: 'LOW',
    occurredAt: '2026-09-24T01:00:00.000Z',
    assessment: {
      transactionId,
      score: 5,
      band: 'LOW',
      contributions: [],
      drain: { balanceAtWindowStart: 800_000, outflow24h: 12_000, drainPct: 1.5, thresholdMet: false, excluded: false },
      evaluatedAt: '2026-09-24T01:00:00.000Z',
    },
  };
  return { ...base, ...overrides };
}

/** The fourth DEMO_TAKEOVER_01 transfer: S$11,500, 65.4% drain of S$52,000, score 95 CRITICAL, HOLD. */
export function demoFinalDecision(): DecisionRecord {
  const contributions = contributionsFrom(DEMO_TAKEOVER_01.finalContributions);
  return decisionRecord({
    transactionId: 'txn_demo_final',
    decision: 'HOLD',
    riskScore: DEMO_TAKEOVER_01.finalScore,
    band: DEMO_TAKEOVER_01.finalBand,
    policyCodes: ['RAPID_DRAIN'],
    reasonCodes: [DECISION_REASON.thresholdExceeded],
    holdUntil: '2026-09-25T01:00:45.000Z',
    decidedAt: '2026-09-24T01:00:45.000Z',
    occurredAt: '2026-09-24T01:00:45.000Z',
    accountId: DEMO_ACCOUNT_ID,
    accountReference: DEMO_TAKEOVER_01.accountDisplayId,
    institutionId: DEMO_TAKEOVER_01.institutionId,
    destinationInstitutionId: 'BANK_C',
    amount: 1_150_000,
    assessment: {
      transactionId: 'txn_demo_final',
      score: DEMO_TAKEOVER_01.finalScore,
      band: DEMO_TAKEOVER_01.finalBand,
      contributions,
      drain: {
        balanceAtWindowStart: DEMO_TAKEOVER_01.openingBalance,
        outflow24h: DEMO_TAKEOVER_01.totalMovedInWindow,
        drainPct: (DEMO_TAKEOVER_01.totalMovedInWindow / DEMO_TAKEOVER_01.openingBalance) * 100,
        thresholdMet: true,
        excluded: false,
      },
      evaluatedAt: '2026-09-24T01:00:45.000Z',
    },
  });
}

/** The third transfer: HIGH, still allowed, 43.3% drain. */
export function demoThirdDecision(): DecisionRecord {
  return decisionRecord({
    transactionId: 'txn_demo_third',
    riskScore: 75,
    band: 'HIGH',
    decidedAt: '2026-09-24T01:00:43.000Z',
    occurredAt: '2026-09-24T01:00:43.000Z',
    accountId: DEMO_ACCOUNT_ID,
    accountReference: DEMO_TAKEOVER_01.accountDisplayId,
    institutionId: DEMO_TAKEOVER_01.institutionId,
    destinationInstitutionId: 'BANK_B',
    amount: 720_000,
  });
}

export function demoAlert(overrides: Partial<Alert> = {}): Alert {
  const decision = demoFinalDecision();
  return {
    id: 'alert_demo',
    accountId: decision.accountId,
    accountReference: DEMO_TAKEOVER_01.accountDisplayId,
    transactionId: decision.transactionId,
    assessmentId: decision.assessmentId,
    score: decision.riskScore,
    band: decision.band,
    onHold: true,
    status: 'OPEN',
    raisedAt: '2026-09-24T01:00:42.000Z',
    updatedAt: decision.decidedAt,
    ...overrides,
  };
}

export function demoHold(overrides: Partial<Intervention> = {}): Intervention {
  const decision = demoFinalDecision();
  return {
    id: 'int_demo_1',
    decisionId: decision.decisionId,
    transactionId: decision.transactionId,
    accountId: decision.accountId,
    previousState: 'EVALUATING',
    state: 'HELD',
    ...(decision.holdUntil ? { holdUntil: decision.holdUntil } : {}),
    reasonCodes: decision.reasonCodes,
    actor: 'SYSTEM',
    actedAt: decision.decidedAt,
    policyVersion: decision.policyVersion,
    rulesetVersion: decision.rulesetVersion,
    assessment: decision.assessment,
    ...overrides,
  };
}
