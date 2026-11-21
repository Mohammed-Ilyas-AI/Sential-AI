import type { MultiScamBurstCase, SentinelSwarmReport } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import { BURST_PROTECTED_MESSAGE, burstCaseLine, burstHoldMessage, burstPushTitle, swarmTriageLines } from './live-demo-autopilot';

const swarm: SentinelSwarmReport = {
  assessmentId: 'asmt-1',
  evaluatedAt: '2026-11-21T03:00:30.000Z',
  overallThreatLevel: 'CRITICAL',
  agents: {
    ato: { isTakeoverLikely: true, deviceRisk: 'UNSEEN_COMPROMISED', authenticationLineage: 'dev_tok_19ce, first seen 2 min ago; high-risk account change within 12h.', atoSignalPoints: 42 },
    beneficiary: { payeeRiskTier: 'FLAGGED_NEIGHBOURHOOD', dormantPayeeActivated: false, counterpartyAssessment: 'Payee PAYEE-5121 is linked to flagged entities in the observed network.' },
    scamIntent: { scamTypology: 'MULE_FORWARDING', outflowPressure: 'ACUTE', behavioralAnomalySummary: 'Matches the mule forwarding pattern. 92.6% of the opening balance has left in 24h.' },
    muleTrace: { observedHops: 2, flaggedNeighbourhood: true, pathEntities: ['acct_tok_20441', 'PAYEE-5121'], observabilityStopReason: 'Observation stops at the recorded neighbourhood; nothing beyond it is inferred.' },
    verification: { proposedChannel: 'AUTOMATED_CALL', recommendedImmediateAction: 'KILL_SWITCH', verificationScript: 'Your bank has noticed unusual activity on your account.' },
    recovery: { killSwitchRecommended: true, heldTransfers: 0, recallRecommendation: 'RECOMMENDED', heldMinorUnits: 0 },
    reporting: { reportVersion: 1, executiveSummary: 'Seven agents agree on mule forwarding.', draftSummary: 'Draft for analyst review.', readyForAnalystReview: true },
  },
};

const muleCase: MultiScamBurstCase = {
  scenario: 'mule',
  scenarioName: 'Mule account',
  institutionId: 'BANK_A',
  accountDisplayId: 'ACC-20441',
  accountId: 'acct_tok_20441',
  transfers: 3,
  decision: 'ALLOW',
  peakScore: 66,
  peakBand: 'HIGH',
  assessmentId: 'asmt-1',
  drainPct: 92.6,
  held: [],
  swarm,
};

describe('live demo console lines', () => {
  it("states each triage agent's finding from the case's own swarm report", () => {
    const lines = swarmTriageLines(swarm);
    expect(lines.map(([speaker]) => speaker)).toEqual(['ATO_AGENT', 'BENEFICIARY_AGENT', 'SCAM_AGENT', 'MULE_AGENT']);
    expect(lines[0]?.[1]).toContain('dev_tok_19ce');
    expect(lines[2]?.[1]).toContain('92.6%');
  });

  it('says so when the swarm report has not arrived, instead of inventing findings', () => {
    expect(swarmTriageLines(null)).toEqual([['SWARM', expect.stringContaining('still being compiled')]]);
  });

  it('describes a burst case by what the gate decided and what the agents recommend', () => {
    expect(burstCaseLine(muleCase)).toBe('ACC-20441 · Bank A · mule forwarding: HIGH 66, not held. Kill switch recommended.');
    expect(burstCaseLine({ ...muleCase, decision: 'HOLD', drainPct: 65.4 })).toContain('HOLD (65.4% drain)');
    const { swarm: _omitted, ...scored } = muleCase;
    expect(burstCaseLine({ ...scored, scenario: 'smurf', scenarioName: 'Smurfing', peakBand: 'LOW', peakScore: 34 })).toContain('Scored and left in the queue');
  });

  it("addresses each burst push to its own customer's bank and account, with the amount the gate held", () => {
    const heldCase: MultiScamBurstCase = {
      ...muleCase,
      institutionId: 'BANK_B',
      accountDisplayId: 'ACC-31760',
      decision: 'HOLD',
      held: [{ transactionId: 'txn-1', assessmentId: 'asmt-2', accountId: 'acct_tok_31760', amount: 3_400_000, riskScore: 95 }],
    };
    expect(burstPushTitle(heldCase)).toBe('Bank B · ACC-31760');
    expect(burstHoldMessage(heldCase)).toBe("We have paused a transfer of S$34,000.00 from your account. If this wasn't you, call the number on the back of your card.");
    expect(burstHoldMessage(muleCase)).toContain('We have paused a transfer from your account');
    expect(BURST_PROTECTED_MESSAGE).not.toMatch(/http|link|password|OTP|PIN/i);
  });

  it('never claims a model, a regulator filing or an action nobody took', () => {
    const text = [...swarmTriageLines(swarm).map(([, line]) => line), burstCaseLine(muleCase)].join(' ');
    expect(text).not.toMatch(/Vertex|Gemini|MAS|CAD|STRO|engaged|dispatched|syndicate|dev-x92/);
  });
});
