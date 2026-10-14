import { DEMO_TAKEOVER_01, type Intervention } from '@sentinel/domain';
import { INSTANT_TIMELINE, buildDemoTakeover01, playScenario, syntheticToken, type PlaybackReport } from '@sentinel/scenarios';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startCoreHarness, type CoreHarness } from '../support/harness/core-test-harness.js';
import { HttpBankConnector, callJson } from '../support/harness/http-bank-connector.js';
import { createInMemoryPersistence, type InMemoryPersistence } from '../support/in-memory-repositories/in-memory-persistence.js';

const EPOCH = '2026-09-24T11:30:00.000Z';
const VICTIM = syntheticToken('acct', DEMO_TAKEOVER_01.accountDisplayId);
const DOCUMENTED_TRANSFERS = DEMO_TAKEOVER_01.steps.filter((step) => step.action === 'TRANSFER');

/**
 * The test that matters (C§7, T§9): DEMO_TAKEOVER_01 driven headless over real HTTP through the real control
 * path. If it fails, the demo is broken and we know before the judges do.
 */
describe('DEMO_TAKEOVER_01 through the control path', () => {
  let persistence: InMemoryPersistence;
  let harness: CoreHarness;
  let playback: PlaybackReport;

  beforeAll(async () => {
    persistence = createInMemoryPersistence();
    harness = await startCoreHarness(persistence, { clockStart: EPOCH });
    playback = await playScenario(buildDemoTakeover01(EPOCH), new HttpBankConnector(harness.baseUrl, harness.clock), INSTANT_TIMELINE);
  });

  afterAll(() => harness.close());

  const victimTransfers = () => playback.transfers.filter((transfer) => transfer.step.request.sourceAccountToken === VICTIM);
  const scriptedTransfers = () => victimTransfers().slice(1);
  const finalTransfer = () => {
    const transfer = scriptedTransfers().at(-1);
    if (!transfer) throw new Error('The final transfer was not played');
    return transfer;
  };

  it('climbs to 21 on the unseen device and 37 on the new payee before any money moves', () => {
    const postures = playback.securityReceipts.slice(0, 2).map((receipt) => receipt.posture.score);
    expect(postures).toEqual([21, 37]);
  });

  it('allows the prior in-window activity without an alert-worthy score', () => {
    const [prior] = victimTransfers();
    expect(prior?.step.request.amount).toBe(DEMO_TAKEOVER_01.priorOutflowInWindow);
    expect(prior?.response.decision).toBe('ALLOW');
    expect(prior?.response.riskScore).toBeLessThan(40);
  });

  it('scores the four transfers 37, 49, 75 and 95 with the documented decisions', () => {
    expect(scriptedTransfers().map((transfer) => transfer.response.riskScore)).toEqual(DOCUMENTED_TRANSFERS.map((step) => step.expectedScore));
    expect(scriptedTransfers().map((transfer) => transfer.response.decision)).toEqual(DOCUMENTED_TRANSFERS.map((step) => step.expectedDecision));
  });

  it('assigns the documented band at every transfer', async () => {
    const bands = await Promise.all(
      scriptedTransfers().map(async (transfer) => (await persistence.decisions.findByIdempotencyKey(transfer.step.request.idempotencyKey))?.band),
    );
    expect(bands).toEqual(DOCUMENTED_TRANSFERS.map((step) => step.expectedBand));
  });

  it('keeps every baseline transfer LOW and allowed', () => {
    const baseline = playback.transfers.filter((transfer) => transfer.step.request.sourceAccountToken !== VICTIM);
    expect(baseline.length).toBeGreaterThan(10);
    for (const transfer of baseline) {
      expect(transfer.response.decision).toBe('ALLOW');
      expect(transfer.response.riskScore).toBeLessThan(40);
    }
  });

  it('meets the rapid-drain threshold on the fourth transfer and not before', async () => {
    const drains = await Promise.all(
      scriptedTransfers().map(async (transfer) => (await persistence.decisions.findByIdempotencyKey(transfer.step.request.idempotencyKey))?.assessment.drain),
    );
    expect(drains.map((drain) => drain?.thresholdMet)).toEqual([false, false, false, true]);
    expect(drains.map((drain) => Number(drain?.drainPct.toFixed(1)))).toEqual([20, 29.4, 43.3, 65.4]);
  });

  it('drains 65.4% of the S$52,000 protected opening balance: S$34,000 in 24 hours', async () => {
    const record = await persistence.decisions.findByIdempotencyKey(finalTransfer().step.request.idempotencyKey);
    expect(record?.assessment.drain).toMatchObject({
      balanceAtWindowStart: DEMO_TAKEOVER_01.openingBalance,
      outflow24h: DEMO_TAKEOVER_01.totalMovedInWindow,
      thresholdMet: true,
      excluded: false,
    });
    expect(record?.band).toBe(DEMO_TAKEOVER_01.finalBand);
  });

  it('records the six documented contributions, summing to 95', async () => {
    const record = await persistence.decisions.findByIdempotencyKey(finalTransfer().step.request.idempotencyKey);
    const contributions = record?.assessment.contributions ?? [];
    expect(Object.fromEntries(contributions.map((contribution) => [contribution.code, contribution.points]))).toEqual(
      DEMO_TAKEOVER_01.finalContributions,
    );
    expect(contributions.reduce((sum, contribution) => sum + contribution.points, 0)).toBe(DEMO_TAKEOVER_01.finalScore);
  });

  it('holds the final transfer for 24 hours under SG-RD-50 with a versioned decision trace', () => {
    const { response } = finalTransfer();
    expect(response).toMatchObject({
      decision: 'HOLD',
      policyCodes: ['RAPID_DRAIN'],
      reasonCodes: ['SG-RD-50_THRESHOLD_EXCEEDED'],
      policyVersion: 'SG-RD-1.0',
      rulesetVersion: '2026.09.24',
    });
    expect(Date.parse(response.holdUntil ?? '') - Date.parse(response.decidedAt)).toBe(DEMO_TAKEOVER_01.holdHours * 3_600_000);
  });

  it('appends a SYSTEM hold to the audit trail with the assessment snapshot', async () => {
    const { body } = await callJson<{ history: Intervention[] }>(harness.baseUrl, 'GET', `/v1/interventions/${finalTransfer().response.transactionId}`);
    expect(body.history).toHaveLength(1);
    expect(body.history[0]).toMatchObject({ previousState: 'EVALUATING', state: 'HELD', actor: 'SYSTEM', policyVersion: 'SG-RD-1.0' });
    expect(body.history[0]?.assessment.score).toBe(95);
  });

  it('promotes the account to a CRITICAL alert marked as held', async () => {
    expect(await persistence.alerts.findOpenByAccountId(VICTIM)).toMatchObject({ band: 'CRITICAL', score: 95, onHold: true });
  });

  it('counts every transfer exactly once in the window after PENDING, AUTHORISED and SETTLED', async () => {
    const outflow = await persistence.outflowWindow.effectiveOutflow({
      accountId: VICTIM,
      afterExclusive: new Date(Date.parse(finalTransfer().step.request.occurredAt) - 24 * 3_600_000).toISOString(),
      upToInclusive: finalTransfer().step.request.occurredAt,
      eligibleForDrainOnly: true,
    });
    expect(outflow).toBe(DEMO_TAKEOVER_01.totalMovedInWindow);
    const settled = await persistence.transactionProjections.findByTransactionId(scriptedTransfers()[0]?.response.transactionId ?? '');
    expect(settled).toMatchObject({ status: 'SETTLED', effectiveAmount: 240_000 });
    const held = await persistence.transactionProjections.findByTransactionId(finalTransfer().response.transactionId);
    expect(held).toMatchObject({ status: 'PENDING', effectiveAmount: 1_150_000 });
  });

  it('answers a retried decision request with the stored decision and no second hold', async () => {
    const { body } = await callJson<{ decisionId: string }>(harness.baseUrl, 'POST', '/v1/decision/transactions', finalTransfer().step.request);
    expect(body.decisionId).toBe(finalTransfer().response.decisionId);
    const { body: trail } = await callJson<{ history: Intervention[] }>(harness.baseUrl, 'GET', `/v1/interventions/${finalTransfer().response.transactionId}`);
    expect(trail.history).toHaveLength(1);
  });

  it('auto-releases the hold, by the system, once the 24-hour cooling period has elapsed', async () => {
    harness.clock.set(finalTransfer().response.holdUntil ?? '');
    harness.clock.advanceBy(1_000);
    expect(await harness.controlPath.interventions.releaseDueHolds(harness.clock.now().toISOString())).toBe(1);
    const { body } = await callJson<{ history: Intervention[] }>(harness.baseUrl, 'GET', `/v1/interventions/${finalTransfer().response.transactionId}`);
    expect(body.history.map((record) => `${record.state}:${record.actor}`)).toEqual(['HELD:SYSTEM', 'RELEASED:SYSTEM']);
  });
});

/**
 * The hold cascade on the scripted takeover: the customer cancels the held S$11,500 and the bank cancels it, so
 * the drain falls back to 43.3%. The attacker's next transfer is still held, by the cascade alone, and nothing
 * the cascade does reaches the documented assessment.
 */
describe('DEMO_TAKEOVER_01 hold cascade', () => {
  let persistence: InMemoryPersistence;
  let harness: CoreHarness;
  let playback: PlaybackReport;
  let connector: HttpBankConnector;

  beforeAll(async () => {
    persistence = createInMemoryPersistence();
    harness = await startCoreHarness(persistence, { clockStart: EPOCH });
    connector = new HttpBankConnector(harness.baseUrl, harness.clock);
    playback = await playScenario(buildDemoTakeover01(EPOCH), connector, INSTANT_TIMELINE);
  });

  afterAll(() => harness.close());

  it('holds the attacker’s next transfer after the trigger is cancelled, without touching the documented 95', async () => {
    const final = playback.transfers.filter((transfer) => transfer.step.request.sourceAccountToken === VICTIM).at(-1);
    if (!final) throw new Error('The final transfer was not played');
    const { request } = final.step;
    const at = (offsetMs: number) => new Date(Date.parse(request.occurredAt) + offsetMs).toISOString();

    const cancelled = await callJson<Intervention>(harness.baseUrl, 'POST', `/v1/interventions/${request.transactionId}/customer-cancellation`);
    expect(cancelled.body).toMatchObject({ state: 'CANCELLED', actor: 'CUSTOMER' });
    await connector.publishLifecycleEvent({
      ...request,
      status: 'CANCELLED',
      eventId: `${request.eventId}-CANCELLED`,
      idempotencyKey: `${request.idempotencyKey}-CANCELLED`,
      accountSequence: request.accountSequence + 100,
      occurredAt: at(30_000),
    });

    const followOn = await connector.requestDecision({
      ...request,
      transactionId: `${request.transactionId}-FOLLOW-ON`,
      eventId: `${request.eventId}-FOLLOW-ON`,
      idempotencyKey: `${request.idempotencyKey}-FOLLOW-ON`,
      networkReference: `${request.networkReference}-FOLLOW-ON`,
      accountSequence: request.accountSequence + 101,
      amount: 100_000,
      occurredAt: at(60_000),
    });
    const record = await persistence.decisions.findByIdempotencyKey(`${request.idempotencyKey}-FOLLOW-ON`);
    expect(record?.assessment.drain).toMatchObject({ thresholdMet: false, outflow24h: 2_350_000 });
    expect(followOn).toMatchObject({ decision: 'HOLD', reasonCodes: ['SG-RD-50_HOLD_CASCADE'], holdUntil: final.response.holdUntil });
    expect(record?.cascadeOfTransactionId).toBe(request.transactionId);

    const trigger = await persistence.decisions.findByIdempotencyKey(request.idempotencyKey);
    expect(trigger?.riskScore).toBe(DEMO_TAKEOVER_01.finalScore);
    expect(Object.fromEntries((trigger?.assessment.contributions ?? []).map((contribution) => [contribution.code, contribution.points]))).toEqual(
      DEMO_TAKEOVER_01.finalContributions,
    );
  });
});
