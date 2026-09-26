import {
  DEMO_TAKEOVER_01,
  RAPID_DRAIN_POLICY_VERSION,
  RULESET_VERSION,
  type Contribution,
  type Intervention,
} from '@sentinel/domain';

/** The attribution panel labels from the Master Document (M§8.1), with the documented demo points. */
const demoContributions: readonly Contribution[] = [
  { code: 'RAPID_DRAIN', label: 'Rapid account depletion', points: 30, detail: '65.4% of the opening balance in 24h' },
  { code: 'NEW_DEVICE', label: 'New device', points: 21, detail: 'first seen under 24h ago' },
  { code: 'NEW_PAYEE', label: 'New beneficiary', points: 16, detail: 'added under 24h ago' },
  { code: 'VELOCITY', label: 'Abnormal transaction velocity', points: 12, detail: 'above 3x baseline' },
  { code: 'ENTITY_LINK', label: 'Suspicious entity relationship', points: 9, detail: 'three flagged entities within two hops' },
  { code: 'BEHAVIOUR_DEV', label: 'Historical behavioural deviation', points: 7, detail: 'above the 95th percentile' },
];

export function interventionFixture(overrides: Partial<Intervention> = {}): Intervention {
  return {
    id: 'int-fixture-0001',
    decisionId: 'dec-fixture-0001',
    transactionId: 'txn-fixture-0001',
    accountId: 'tok-acc-fixture-0001',
    previousState: 'EVALUATING',
    state: 'HELD',
    holdUntil: '2026-09-25T00:00:45.000Z',
    reasonCodes: ['SG-RD-50_THRESHOLD_EXCEEDED'],
    actor: 'SYSTEM',
    actedAt: '2026-09-24T00:00:45.000Z',
    policyVersion: RAPID_DRAIN_POLICY_VERSION,
    rulesetVersion: RULESET_VERSION,
    assessment: {
      transactionId: 'txn-fixture-0001',
      score: DEMO_TAKEOVER_01.finalScore,
      band: 'CRITICAL',
      contributions: demoContributions,
      drain: {
        balanceAtWindowStart: DEMO_TAKEOVER_01.openingBalance,
        outflow24h: DEMO_TAKEOVER_01.totalMovedInWindow,
        drainPct: (DEMO_TAKEOVER_01.totalMovedInWindow / DEMO_TAKEOVER_01.openingBalance) * 100,
        thresholdMet: true,
        excluded: false,
      },
      evaluatedAt: '2026-09-24T00:00:45.000Z',
    },
    ...overrides,
  };
}
