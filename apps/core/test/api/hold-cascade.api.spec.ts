import type { DecisionRequest, DecisionResponse, Intervention, TransactionType } from '@sentinel/domain';
import { ScenarioEventFactory, SYNTHETIC_ACCOUNTS, syntheticToken, type SyntheticAccount } from '@sentinel/scenarios';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startCoreHarness, type CoreHarness } from '../support/harness/core-test-harness.js';
import { callJson, pushEnvelopeFor } from '../support/harness/http-bank-connector.js';
import { createInMemoryPersistence, type InMemoryPersistence } from '../support/in-memory-repositories/in-memory-persistence.js';

const EPOCH = '2026-09-24T11:30:00.000Z';
const HOUR_MS = 3_600_000;
const VICTIM = SYNTHETIC_ACCOUNTS.find((candidate) => candidate.displayId === 'ACC-10291') as SyntheticAccount;
const BILLER = 'SP-UTILITIES';

/**
 * The post-threshold hold cascade (T§4, M§5.3): the transfer that breaches SG-RD-50 and every subsequent
 * eligible outflow on the account enter the hold state. Exclusions stay outside it; the score never moves.
 *
 * Shape of every case: S$52,000 reported 24 hours before EPOCH; S$25,000 leaves at EPOCH − 23h (48.1%, allowed);
 * S$1,000.01 at EPOCH breaches 50% and is held until EPOCH + 24h. Two hours later the S$25,000 has left the
 * rolling window, so the drain arithmetic alone would allow anything: only the cascade still holds.
 */
describe('SG-RD-50 hold cascade', () => {
  let persistence: InMemoryPersistence;
  let harness: CoreHarness;
  let events: ScenarioEventFactory;

  const decideAt = async (request: DecisionRequest) => {
    harness.clock.set(request.occurredAt);
    return (await callJson<DecisionResponse>(harness.baseUrl, 'POST', '/v1/decision/transactions', request)).body;
  };
  const outflow = (amount: number, occurredAt: string, type: TransactionType = 'TRANSFER', payeeId = 'PAYEE-2251') =>
    events.transfer({ source: VICTIM, payeeId, destinationInstitutionId: 'BANK_B', amount, deviceId: events.homeDevice(VICTIM), occurredAt, type });
  const afterBreach = (hours: number) => events.at(hours * HOUR_MS);
  const historyOf = async (transactionId: string) =>
    (await callJson<{ history: Intervention[] }>(harness.baseUrl, 'GET', `/v1/interventions/${transactionId}`)).body.history ?? [];
  const act = (transactionId: string, action: string, body?: unknown) =>
    callJson<Intervention>(harness.baseUrl, 'POST', `/v1/interventions/${transactionId}/${action}`, body);

  const breach = async () => {
    expect((await decideAt(outflow(2_500_000, events.hoursBefore(23)).request)).decision).toBe('ALLOW');
    return decideAt(outflow(100_001, EPOCH).request);
  };

  const start = async () => {
    persistence = createInMemoryPersistence();
    harness = await startCoreHarness(persistence, { clockStart: EPOCH, designatedBillingPayeeIds: new Set([syntheticToken('ben', BILLER)]) });
    events = new ScenarioEventFactory('CASCADE', Date.parse(EPOCH));
    await callJson(harness.baseUrl, 'PUT', `/v1/accounts/${syntheticToken('acct', VICTIM.displayId)}`, events.accountReport(VICTIM, 5_200_000, 1, EPOCH));
  };

  beforeEach(start);
  afterEach(() => harness.close());

  describe('the triggering transaction', () => {
    it('is held under SG-RD-50_THRESHOLD_EXCEEDED for 24 hours, with no cascade origin', async () => {
      const trigger = await breach();
      expect(trigger).toMatchObject({ decision: 'HOLD', policyCodes: ['RAPID_DRAIN'], reasonCodes: ['SG-RD-50_THRESHOLD_EXCEEDED'] });
      expect(Date.parse(trigger.holdUntil ?? '') - Date.parse(trigger.decidedAt)).toBe(24 * HOUR_MS);
      const [hold] = await historyOf(trigger.transactionId);
      expect(hold).toMatchObject({ previousState: 'EVALUATING', state: 'HELD', actor: 'SYSTEM', reasonCodes: ['SG-RD-50_THRESHOLD_EXCEEDED'] });
      expect(hold?.cascadeOfTransactionId).toBeUndefined();
    });
  });

  describe('subsequent eligible outflows', () => {
    it('are each held until the trigger’s cooling period ends, although the drain alone would allow them', async () => {
      const trigger = await breach();
      for (const [hours, type, payee] of [
        [2, 'TRANSFER', 'PAYEE-2251'],
        [3, 'TRANSFER', 'PAYEE-9281'],
        [6, 'BILL', 'SP-NOT-DESIGNATED'],
        [23.9, 'TRANSFER', 'PAYEE-2251'],
      ] as const) {
        const planned = outflow(10_000, afterBreach(hours), type, payee);
        const response = await decideAt(planned.request);
        expect(response).toMatchObject({ decision: 'HOLD', policyCodes: ['RAPID_DRAIN'], reasonCodes: ['SG-RD-50_HOLD_CASCADE'], holdUntil: trigger.holdUntil });

        const record = await persistence.decisions.findByIdempotencyKey(planned.request.idempotencyKey);
        expect(record?.assessment.drain.thresholdMet).toBe(false);
        expect(record?.cascadeOfTransactionId).toBe(trigger.transactionId);
        expect(await historyOf(response.transactionId)).toEqual([
          expect.objectContaining({
            previousState: 'EVALUATING',
            state: 'HELD',
            actor: 'SYSTEM',
            reasonCodes: ['SG-RD-50_HOLD_CASCADE'],
            holdUntil: trigger.holdUntil,
            cascadeOfTransactionId: trigger.transactionId,
          }),
        ]);
      }
    });

    it('changes the decision only: the score and its contributions are exactly those without the cascade', async () => {
      const assessmentOf = async (request: DecisionRequest) => (await persistence.decisions.findByIdempotencyKey(request.idempotencyKey))?.assessment;
      await breach();
      const cascadedPlan = outflow(10_000, afterBreach(2));
      const cascaded = await decideAt(cascadedPlan.request);
      const cascadedAssessment = await assessmentOf(cascadedPlan.request);

      // The identical history in a fresh core, except that the customer verified and the trigger was released.
      await harness.close();
      await start();
      const released = await breach();
      await act(released.transactionId, 'customer-verified-release');
      const uncascadedPlan = outflow(10_000, afterBreach(2));
      const uncascaded = await decideAt(uncascadedPlan.request);

      expect([cascaded.decision, uncascaded.decision]).toEqual(['HOLD', 'ALLOW']);
      expect(cascaded.riskScore).toBe(uncascaded.riskScore);
      expect(cascadedAssessment?.contributions).toEqual((await assessmentOf(uncascadedPlan.request))?.contributions);
      expect(cascadedAssessment?.contributions.reduce((sum, contribution) => sum + contribution.points, 0)).toBe(cascaded.riskScore);
    });

    it('does not reach back to an outflow that occurred before the breach, whenever it arrives', async () => {
      await breach();
      const late = await decideAt({ ...outflow(50_000, events.hoursBefore(1)).request });
      expect(late).toMatchObject({ decision: 'ALLOW', reasonCodes: ['SG-RD-50_GATE_NOT_MET'] });
      expect(await historyOf(late.transactionId)).toEqual([]);
    });
  });

  describe('exclusions', () => {
    it('leaves standing instructions, GIRO/eGIRO and designated bill payments outside the cascade', async () => {
      await breach();
      const excluded = [
        outflow(400_000, afterBreach(2), 'STANDING'),
        outflow(400_000, afterBreach(2.5), 'GIRO'),
        outflow(400_000, afterBreach(3), 'BILL', BILLER),
      ];
      for (const planned of excluded) {
        const response = await decideAt(planned.request);
        expect(response).toMatchObject({ decision: 'ALLOW', policyCodes: [], reasonCodes: ['SG-RD-50_EXCLUDED'] });
        expect(response.holdUntil).toBeUndefined();
        expect(await historyOf(response.transactionId)).toEqual([]);
      }
      expect((await decideAt(outflow(10_000, afterBreach(4)).request)).reasonCodes).toEqual(['SG-RD-50_HOLD_CASCADE']);
    });
  });

  describe('idempotency and lifecycle accounting', () => {
    it('answers a retried decision with the stored cascaded decision and appends no second hold', async () => {
      await breach();
      const planned = outflow(10_000, afterBreach(2));
      const first = await decideAt(planned.request);
      const retried = await decideAt(planned.request);
      expect(retried).toEqual(first);
      expect(await historyOf(first.transactionId)).toHaveLength(1);
    });

    it('counts duplicate and retried lifecycle events once, and they neither start nor end the cascade', async () => {
      await breach();
      const giro = outflow(400_000, afterBreach(2), 'GIRO');
      await decideAt(giro.request);
      const push = async (event: unknown) =>
        (await callJson<{ outcome: string }>(harness.baseUrl, 'POST', '/internal/pubsub/transaction-events', pushEnvelopeFor(event as DecisionRequest))).body.outcome;
      const outcomes = [];
      for (const event of [...giro.lifecycleOnAllow, ...giro.lifecycleOnAllow]) outcomes.push(await push(event));
      expect(outcomes).toEqual(['PROJECTED', 'PROJECTED', 'DUPLICATE', 'DUPLICATE']);
      expect(await persistence.transactionProjections.findByTransactionId(giro.request.transactionId)).toMatchObject({ status: 'SETTLED', effectiveAmount: 400_000 });

      const held = outflow(10_000, afterBreach(3));
      const response = await decideAt(held.request);
      expect(response.reasonCodes).toEqual(['SG-RD-50_HOLD_CASCADE']);
      expect(await push(held.request)).not.toBe('PROJECTED');
      expect(await persistence.transactionProjections.findByTransactionId(held.request.transactionId)).toMatchObject({ status: 'PENDING', effectiveAmount: 10_000 });
      expect(await historyOf(response.transactionId)).toHaveLength(1);
    });
  });

  describe('transitions', () => {
    it('ends with the cooling period: the system releases the trigger and every cascaded hold together', async () => {
      const trigger = await breach();
      const cascaded = [await decideAt(outflow(10_000, afterBreach(2)).request), await decideAt(outflow(20_000, afterBreach(5)).request)];
      harness.clock.set(trigger.holdUntil ?? '');
      expect(await harness.controlPath.interventions.releaseDueHolds(harness.clock.now().toISOString())).toBe(3);
      for (const { transactionId } of cascaded) {
        expect((await historyOf(transactionId)).map((record) => `${record.state}:${record.actor}:${record.reasonCodes.join()}`)).toEqual([
          'HELD:SYSTEM:SG-RD-50_HOLD_CASCADE',
          'RELEASED:SYSTEM:SG-RD-50_COOLING_PERIOD_ELAPSED',
        ]);
      }
      expect((await decideAt(outflow(10_000, afterBreach(24)).request)).decision).toBe('ALLOW');
    });

    it('ends when the customer verifies and the trigger is released; holds already placed stay until resolved', async () => {
      const trigger = await breach();
      const before = await decideAt(outflow(10_000, afterBreach(2)).request);
      expect((await act(trigger.transactionId, 'customer-verified-release')).body).toMatchObject({ state: 'RELEASED', actor: 'CUSTOMER' });

      const after = await decideAt(outflow(10_000, afterBreach(3)).request);
      expect(after).toMatchObject({ decision: 'ALLOW', reasonCodes: ['NOT_PROTECTED_BALANCE'] });
      expect((await historyOf(before.transactionId)).map((record) => record.state)).toEqual(['HELD']);
      expect((await act(before.transactionId, 'customer-verified-release')).body).toMatchObject({
        previousState: 'HELD',
        state: 'RELEASED',
        actor: 'CUSTOMER',
        cascadeOfTransactionId: trigger.transactionId,
      });
    });

    it('stays in force after a customer cancellation: the account is not shown to be safe', async () => {
      const trigger = await breach();
      expect((await act(trigger.transactionId, 'customer-cancellation')).body).toMatchObject({ state: 'CANCELLED', actor: 'CUSTOMER' });
      const next = await decideAt(outflow(10_000, afterBreach(2)).request);
      expect(next).toMatchObject({ decision: 'HOLD', reasonCodes: ['SG-RD-50_HOLD_CASCADE'], holdUntil: trigger.holdUntil });
      expect((await act(next.transactionId, 'customer-cancellation')).body).toMatchObject({ state: 'CANCELLED', cascadeOfTransactionId: trigger.transactionId });
    });

    it('stays in force after an analyst confirms fraud, and a cascaded hold is rejected only with an analyst identity', async () => {
      const trigger = await breach();
      await act(trigger.transactionId, 'fraud-confirmation', { analystIdentity: 'demo-analyst' });
      const next = await decideAt(outflow(10_000, afterBreach(2)).request);
      expect(next.reasonCodes).toEqual(['SG-RD-50_HOLD_CASCADE']);
      expect((await act(next.transactionId, 'fraud-confirmation', {})).status).toBe(400);
      expect((await act(next.transactionId, 'fraud-confirmation', { analystIdentity: 'demo-analyst' })).body).toMatchObject({
        state: 'REJECTED',
        actor: 'ANALYST',
        actorIdentity: 'demo-analyst',
        reasonCodes: ['ANALYST_CONFIRMED_FRAUD'],
      });
      expect((await act(next.transactionId, 'customer-verified-release')).status).toBe(409);
    });
  });
});
