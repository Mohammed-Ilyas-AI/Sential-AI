import {
  DEMO_TAKEOVER_01,
  MULTI_SCAM_BURST_01,
  PROTECTED_BALANCE_MINOR,
  RAPID_DRAIN_GATE_PERCENT,
  runAccountReference,
  type DecisionResponse,
  type LiveDemoReport,
  type MultiScamBurstCase,
  type MultiScamBurstReport,
} from '@sentinel/domain';
import { afterEach, describe, expect, it } from 'vitest';
import { startCoreHarness, type CoreHarness } from '../support/harness/core-test-harness.js';
import { callJson } from '../support/harness/http-bank-connector.js';
import { createInMemoryPersistence } from '../support/in-memory-repositories/in-memory-persistence.js';

describe('/v1/demo/live-demo — DEMO_TAKEOVER_01 through the control path, in-process', () => {
  let harness: CoreHarness;
  afterEach(() => harness.close());

  it('plays the synthetic takeover through the real gate and reports the transfer it held', async () => {
    const persistence = createInMemoryPersistence();
    harness = await startCoreHarness(persistence, { clockStart: '2026-09-24T11:30:00.000Z' });

    const response = await callJson<LiveDemoReport>(harness.baseUrl, 'POST', '/v1/demo/live-demo', { analystIdentity: 'analyst.tan' });
    expect(response.status).toBe(200);
    expect(response.body.scenarioId).toBe('DEMO_TAKEOVER_01');
    expect(response.body.transfers).toBeGreaterThan(4);
    const final = DEMO_TAKEOVER_01.steps.at(-1);
    expect(response.body.held).toHaveLength(1);
    expect(response.body.held[0]).toMatchObject({ amount: final && 'amount' in final ? final.amount : -1, riskScore: 95 });
    const audit = await callJson<{ events: { action: string }[] }>(harness.baseUrl, 'GET', '/v1/audit-events?limit=10');
    expect(audit.body.events.map((event) => event.action)).toContain('LIVE_DEMO_STARTED');
  });

  it("plays the attacker's next transfer through the gate: held by the kill switch once it is active", async () => {
    harness = await startCoreHarness(createInMemoryPersistence(), { clockStart: '2026-09-24T11:30:00.000Z' });
    const run = await callJson<LiveDemoReport>(harness.baseUrl, 'POST', '/v1/demo/live-demo', { analystIdentity: 'analyst.tan' });
    const held = run.body.held[0];
    if (!held) throw new Error('no hold');
    const activated = await callJson(harness.baseUrl, 'POST', `/v1/accounts/${held.accountId}/kill-switch`, {
      analystIdentity: 'analyst.tan',
      reason: 'Customer unreachable',
      idempotencyKey: 'k-1',
      confirmAccountId: held.accountId,
    });
    expect(activated.status).toBe(201);
    const next = await callJson<DecisionResponse>(harness.baseUrl, 'POST', `/v1/demo/live-demo/${run.body.runId}/follow-up-transfer`, { analystIdentity: 'analyst.tan' });
    expect(next.status).toBe(200);
    expect(next.body).toMatchObject({ decision: 'HOLD', policyCodes: ['KILL_SWITCH'] });
    expect((await callJson(harness.baseUrl, 'POST', '/v1/demo/live-demo/NOPE/follow-up-transfer', { analystIdentity: 'analyst.tan' })).status).toBe(404);
  });

  it('needs an analyst identity', async () => {
    harness = await startCoreHarness(createInMemoryPersistence());
    expect((await callJson(harness.baseUrl, 'POST', '/v1/demo/live-demo', {})).status).toBe(400);
    expect((await callJson(harness.baseUrl, 'POST', '/v1/demo/live-demo/burst', {})).status).toBe(400);
  });
});

describe('/v1/demo/live-demo/burst — MULTI_SCAM_BURST_01, twelve concurrent cases through the control path', () => {
  let harness: CoreHarness;
  afterEach(() => harness.close());

  it("plays the reference's four scenarios on three banks and holds exactly what SG-RD-50 holds", async () => {
    harness = await startCoreHarness(createInMemoryPersistence(), { clockStart: '2026-11-21T03:00:00.000Z' });
    const response = await callJson<MultiScamBurstReport>(harness.baseUrl, 'POST', '/v1/demo/live-demo/burst', { analystIdentity: 'analyst.tan' });
    expect(response.status).toBe(200);
    const { cases } = response.body;
    expect(response.body.scenarioId).toBe('MULTI_SCAM_BURST_01');
    expect(cases).toHaveLength(12);
    expect(new Set(cases.map((entry) => entry.scenario))).toEqual(new Set(['phishing', 'mule', 'smurf', 'replay']));
    expect(new Set(cases.map((entry) => entry.institutionId))).toEqual(new Set(['BANK_A', 'BANK_B', 'BANK_C']));

    const balanceOf = (entry: MultiScamBurstCase) => MULTI_SCAM_BURST_01.cases.find((spec) => runAccountReference(spec.accountDisplayId, response.body.runId) === entry.accountDisplayId)?.balance ?? 0;
    for (const entry of cases) {
      const protectedAccount = balanceOf(entry) >= PROTECTED_BALANCE_MINOR;
      // The gate holds a transfer only on a protected account whose 24h outflow passes 50% of the opening balance.
      if (entry.decision === 'HOLD') {
        expect(protectedAccount).toBe(true);
        expect(entry.drainPct).toBeGreaterThan(RAPID_DRAIN_GATE_PERCENT);
      } else {
        expect(!protectedAccount || entry.drainPct <= RAPID_DRAIN_GATE_PERCENT).toBe(true);
      }
    }
    expect(cases.filter((entry) => entry.decision === 'HOLD').length).toBeGreaterThan(0);
    // The rules alert more than they hold: high-risk cases the gate does not hold are left for the analyst.
    expect(cases.some((entry) => entry.decision === 'ALLOW' && (entry.peakBand === 'HIGH' || entry.peakBand === 'CRITICAL'))).toBe(true);
  });

  it('has the 7-agent swarm work every held or high-risk case, from that case’s own evidence', async () => {
    harness = await startCoreHarness(createInMemoryPersistence(), { clockStart: '2026-11-21T03:00:00.000Z' });
    const { body } = await callJson<MultiScamBurstReport>(harness.baseUrl, 'POST', '/v1/demo/live-demo/burst', { analystIdentity: 'analyst.tan' });
    const worked = body.cases.filter((entry) => entry.decision === 'HOLD' || entry.peakBand === 'HIGH' || entry.peakBand === 'CRITICAL');
    expect(worked.length).toBeGreaterThan(0);
    for (const entry of worked) {
      expect(entry.swarm?.assessmentId).toBe(entry.assessmentId);
      expect(Object.keys(entry.swarm?.agents ?? {})).toHaveLength(7);
    }
    const phishing = body.cases.filter((entry) => entry.scenario === 'phishing' && entry.swarm);
    expect(phishing.every((entry) => entry.swarm?.agents.ato.isTakeoverLikely)).toBe(true);
    // The scam-pattern agent names the reference scenario each case actually played, from its recorded signals.
    const expected = { phishing: 'ACCOUNT_TAKEOVER', mule: 'MULE_FORWARDING', replay: 'CREDENTIAL_REPLAY', smurf: 'SMURFING' } as const;
    for (const entry of worked) expect(entry.swarm?.agents.scamIntent.scamTypology).toBe(expected[entry.scenario]);
    expect(worked.filter((entry) => entry.swarm?.agents.recovery.killSwitchRecommended && entry.decision !== 'HOLD').length).toBeGreaterThan(0);
    const audit = await callJson<{ events: { action: string }[] }>(harness.baseUrl, 'GET', '/v1/audit-events?limit=20');
    expect(audit.body.events.map((event) => event.action)).toContain('MULTI_SCAM_BURST_STARTED');
  });

  it('runs one demo at a time: a burst while another is playing is refused', async () => {
    // The burst's timeline waits until the second request has been answered, so the two really overlap.
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    harness = await startCoreHarness(createInMemoryPersistence(), {
      clockStart: '2026-11-21T03:00:00.000Z',
      liveDemoTimeline: () => ({ waitUntil: () => gate }),
    });
    const first = callJson(harness.baseUrl, 'POST', '/v1/demo/live-demo/burst', { analystIdentity: 'analyst.tan' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const second = await callJson(harness.baseUrl, 'POST', '/v1/demo/live-demo', { analystIdentity: 'analyst.lee' });
    expect(second.status).toBe(409);
    release();
    expect((await first).status).toBe(200);
  });
});
