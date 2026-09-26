import type { DecisionRequest, DecisionResponse, SecurityEventReceipt } from '@sentinel/domain';
import { ScenarioEventFactory, SYNTHETIC_ACCOUNTS, syntheticToken, type SyntheticAccount } from '@sentinel/scenarios';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startCoreHarness, type CoreHarness } from '../support/harness/core-test-harness.js';
import { callJson, pushEnvelopeFor } from '../support/harness/http-bank-connector.js';
import { createInMemoryPersistence, type InMemoryPersistence } from '../support/in-memory-repositories/in-memory-persistence.js';

const EPOCH = '2026-09-24T11:30:00.000Z';
const account = (displayId: string): SyntheticAccount => {
  const found = SYNTHETIC_ACCOUNTS.find((candidate) => candidate.displayId === displayId);
  if (!found) throw new Error(displayId);
  return found;
};
const PROTECTED = account('ACC-10291');
const SMALL = account('ACC-20441');

describe('control-path HTTP API', () => {
  let persistence: InMemoryPersistence;
  let harness: CoreHarness;
  let events: ScenarioEventFactory;

  const report = async (subject: SyntheticAccount, balance: number) =>
    callJson<{ protected: boolean }>(harness.baseUrl, 'PUT', `/v1/accounts/${syntheticToken('acct', subject.displayId)}`, events.accountReport(subject, balance, 1, EPOCH));
  const decide = (request: unknown) => callJson<DecisionResponse & { problems?: string[] }>(harness.baseUrl, 'POST', '/v1/decision/transactions', request);
  const transfer = (subject: SyntheticAccount, amount: number, offsetMs: number, type: 'TRANSFER' | 'GIRO' | 'BILL' = 'TRANSFER', payeeId = 'PAYEE-2251') =>
    events.transfer({ source: subject, payeeId, destinationInstitutionId: 'BANK_B', amount, deviceId: events.homeDevice(subject), occurredAt: events.at(offsetMs), type });

  beforeEach(async () => {
    persistence = createInMemoryPersistence();
    harness = await startCoreHarness(persistence, { clockStart: EPOCH, designatedBillingPayeeIds: new Set([syntheticToken('ben', 'SP-UTILITIES')]) });
    events = new ScenarioEventFactory('API', Date.parse(EPOCH));
    await report(PROTECTED, 5_200_000);
    await report(SMALL, 940_000);
  });

  afterEach(() => harness.close());

  describe('PUT /v1/accounts/{accountToken}', () => {
    it('records the report and derives protection from the configured balance', async () => {
      expect((await report(PROTECTED, 5_200_000)).body.protected).toBe(true);
      expect((await report(SMALL, 940_000)).body.protected).toBe(false);
    });

    it('rejects a report whose token does not match the path', async () => {
      const body = events.accountReport(PROTECTED, 5_200_000, 1, EPOCH);
      const response = await callJson(harness.baseUrl, 'PUT', '/v1/accounts/acct_tok_other', body);
      expect(response.status).toBe(400);
    });
  });

  describe('POST /v1/decision/transactions — validation', () => {
    it('requires an idempotencyKey', async () => {
      const { idempotencyKey, ...withoutKey } = transfer(PROTECTED, 10_000, 1_000).request;
      const response = await decide(withoutKey);
      expect(response.status).toBe(400);
      expect(response.body.problems).toContain('idempotencyKey must be a non-empty string');
    });

    it('rejects fractional money and raw account numbers', async () => {
      const request = transfer(PROTECTED, 10_000, 1_000).request;
      const response = await decide({ ...request, amount: 100.5, destinationAccountToken: '1234567890123' });
      expect(response.status).toBe(400);
      expect(response.body.problems).toEqual([
        'destinationAccountToken must be a token, never a raw account number',
        'amount must be an integer amount in minor units greater than zero',
      ]);
    });

    it('accepts only PENDING: decisions are asked for before the transfer commits', async () => {
      const response = await decide({ ...transfer(PROTECTED, 10_000, 1_000).request, status: 'SETTLED' });
      expect(response.status).toBe(400);
    });

    it('rejects a decision for an account the bank never reported', async () => {
      const request = { ...transfer(PROTECTED, 10_000, 1_000).request, sourceAccountToken: 'acct_tok_unknown1' };
      expect((await decide(request)).status).toBe(422);
    });

    it('returns exactly the DecisionResponse contract, never the stored extras', async () => {
      const response = await decide(transfer(PROTECTED, 10_000, 1_000).request);
      expect(response.status).toBe(200);
      expect(Object.keys(response.body).sort()).toEqual(
        ['assessmentId', 'decidedAt', 'decision', 'decisionId', 'expiresAt', 'idempotencyKey', 'policyCodes', 'policyVersion', 'reasonCodes', 'riskScore', 'rulesetVersion', 'tenantId', 'traceId', 'transactionId'].sort(),
      );
      expect(response.body.reasonCodes).toEqual(['SG-RD-50_GATE_NOT_MET']);
    });
  });

  describe('POST /v1/decision/transactions — policy gate', () => {
    it('holds the transfer that crosses 50% and every subsequent outflow', async () => {
      expect((await decide(transfer(PROTECTED, 2_500_000, 1_000).request)).body.decision).toBe('ALLOW');
      const crossing = await decide(transfer(PROTECTED, 100_001, 2_000).request);
      expect(crossing.body).toMatchObject({ decision: 'HOLD', reasonCodes: ['SG-RD-50_THRESHOLD_EXCEEDED'] });
      const subsequent = await decide(transfer(PROTECTED, 100, 3_000).request);
      expect(subsequent.body.decision).toBe('HOLD');
    });

    it('bypasses the safeguard for GIRO and designated bill payments, which never count toward the drain', async () => {
      const giro = await decide(transfer(PROTECTED, 4_000_000, 1_000, 'GIRO').request);
      expect(giro.body).toMatchObject({ decision: 'ALLOW', reasonCodes: ['SG-RD-50_EXCLUDED'] });
      const bill = await decide(transfer(PROTECTED, 500_000, 2_000, 'BILL', 'SP-UTILITIES').request);
      expect(bill.body.reasonCodes).toEqual(['SG-RD-50_EXCLUDED']);
      const next = await decide(transfer(PROTECTED, 2_000_000, 3_000).request);
      expect(next.body.decision).toBe('ALLOW');
    });

    it('never holds an account below the protected balance, whatever the drain', async () => {
      const response = await decide(transfer(SMALL, 900_000, 1_000).request);
      expect(response.body).toMatchObject({ decision: 'ALLOW', reasonCodes: ['NOT_PROTECTED_BALANCE'] });
    });
  });

  describe('POST /internal/pubsub/transaction-events — lifecycle projection', () => {
    const push = (body: unknown) => callJson<{ outcome?: string }>(harness.baseUrl, 'POST', '/internal/pubsub/transaction-events', body);

    const lifecycleOf = (planned: ReturnType<typeof transfer>) => {
      const [authorised, settled] = planned.lifecycleOnAllow;
      if (!authorised || !settled) throw new Error('A transfer plans AUTHORISED and SETTLED');
      return { authorised, settled };
    };

    it('projects AUTHORISED and SETTLED without double counting, and deduplicates a retried event', async () => {
      const planned = transfer(PROTECTED, 240_000, 1_000);
      const { request, lifecycleOnAllow } = planned;
      await decide(request);
      for (const event of lifecycleOnAllow) expect((await push(pushEnvelopeFor(event))).body.outcome).toBe('PROJECTED');
      expect((await push(pushEnvelopeFor(lifecycleOf(planned).settled))).body.outcome).toBe('DUPLICATE');
      expect(await persistence.transactionProjections.findByTransactionId(request.transactionId)).toMatchObject({ status: 'SETTLED', effectiveAmount: 240_000 });
    });

    it('zeroes a REVERSED transfer so it no longer counts toward the drain', async () => {
      const { request } = transfer(PROTECTED, 2_500_000, 1_000);
      await decide(request);
      const reversed = { ...request, status: 'REVERSED', eventId: 'EVT-reversal', idempotencyKey: 'idem-reversal', accountSequence: request.accountSequence + 10 };
      expect((await push(pushEnvelopeFor(reversed as DecisionRequest))).body.outcome).toBe('PROJECTED');
      expect((await decide(transfer(PROTECTED, 2_000_000, 2_000).request)).body.decision).toBe('ALLOW');
    });

    it('applies an out-of-order event to history only', async () => {
      const planned = transfer(PROTECTED, 240_000, 1_000);
      await decide(planned.request);
      await push(pushEnvelopeFor(lifecycleOf(planned).settled));
      expect((await push(pushEnvelopeFor(lifecycleOf(planned).authorised))).body.outcome).toBe('HISTORY_ONLY');
    });

    it('rejects a malformed envelope and an invalid event', async () => {
      expect((await push({})).status).toBe(400);
      const { request } = transfer(PROTECTED, 240_000, 1_000);
      expect((await push(pushEnvelopeFor({ ...request, currency: 'USD' } as unknown as DecisionRequest))).status).toBe(400);
    });

    it('rejects an unauthenticated push when OIDC verification is on', async () => {
      const secured = await startCoreHarness(createInMemoryPersistence(), {
        pubsubPush: { mode: 'google-oidc', audience: 'https://sentinel-core.example', serviceAccountEmail: 'push@example.iam.gserviceaccount.com' },
      });
      const response = await callJson(secured.baseUrl, 'POST', '/internal/pubsub/transaction-events', {}, { authorization: 'Bearer forged' });
      expect(response.status).toBe(401);
      await secured.close();
    });
  });

  describe('POST /v1/events/security', () => {
    const record = (body: unknown) => callJson<SecurityEventReceipt & { problems?: string[] }>(harness.baseUrl, 'POST', '/v1/events/security', body);

    it('requires the subject of the event', async () => {
      const { beneficiaryToken, ...event } = events.securityEvent(PROTECTED, 'PAYEE_ADDED', events.at(1_000), { payeeId: 'PAYEE-9281' });
      expect((await record(event)).body.problems).toContain('beneficiaryToken is required for PAYEE_ADDED');
    });

    it('starts a 12-hour cooling-off on a password change and scores it', async () => {
      const receipt = await record(events.securityEvent(PROTECTED, 'PASSWORD_CHANGED', events.at(1_000)));
      expect(receipt.body.posture.contributions.map((contribution) => contribution.code)).toContain('COOLING_OFF');
    });

    it('records an event once and reports a retry as DUPLICATE', async () => {
      const event = events.securityEvent(PROTECTED, 'NEW_DEVICE', events.at(1_000), { deviceId: 'DEV-API' });
      expect((await record(event)).body.outcome).toBe('RECORDED');
      expect((await record(event)).body.outcome).toBe('DUPLICATE');
    });

    it('rejects an event for an unknown account', async () => {
      const event = { ...events.securityEvent(PROTECTED, 'PASSWORD_CHANGED', events.at(1_000)), accountToken: 'acct_tok_unknown1' };
      expect((await record(event)).status).toBe(422);
    });
  });

  describe('/v1/interventions — exceptions around a policy hold', () => {
    const holdOne = async () => {
      await decide(transfer(PROTECTED, 2_500_000, 1_000).request);
      return (await decide(transfer(PROTECTED, 100_001, 2_000).request)).body.transactionId;
    };

    it('releases after customer verification, then refuses a second move', async () => {
      const transactionId = await holdOne();
      const released = await callJson<{ state: string; actor: string }>(harness.baseUrl, 'POST', `/v1/interventions/${transactionId}/customer-verified-release`);
      expect(released.body).toMatchObject({ state: 'RELEASED', actor: 'CUSTOMER' });
      const again = await callJson(harness.baseUrl, 'POST', `/v1/interventions/${transactionId}/customer-cancellation`);
      expect(again.status).toBe(409);
    });

    it('rejects as confirmed fraud only with an analyst identity', async () => {
      const transactionId = await holdOne();
      expect((await callJson(harness.baseUrl, 'POST', `/v1/interventions/${transactionId}/fraud-confirmation`, {})).status).toBe(400);
      const rejected = await callJson<{ state: string; actor: string; actorIdentity: string }>(
        harness.baseUrl,
        'POST',
        `/v1/interventions/${transactionId}/fraud-confirmation`,
        { analystIdentity: 'demo-analyst' },
      );
      expect(rejected.body).toMatchObject({ state: 'REJECTED', actor: 'ANALYST', actorIdentity: 'demo-analyst' });
    });

    it('offers no route for an analyst to release a policy hold', async () => {
      const transactionId = await holdOne();
      expect((await callJson(harness.baseUrl, 'POST', `/v1/interventions/${transactionId}/release`)).status).toBe(404);
    });

    it('answers 404 for a transfer that was never held', async () => {
      expect((await callJson(harness.baseUrl, 'POST', '/v1/interventions/TX-never/customer-cancellation')).status).toBe(404);
    });
  });

  describe('POST /v1/network/observations', () => {
    it('rejects an edge whose scoring disagrees with its linkage', async () => {
      const response = await callJson<{ problems: string[] }>(harness.baseUrl, 'POST', '/v1/network/observations', {
        schemaVersion: '1.0',
        nodes: [],
        edges: [
          {
            from: 'acct_tok_a',
            to: 'acct_tok_b',
            kind: 'TRANSFERRED_TO',
            weight: 1,
            firstSeen: EPOCH,
            lastSeen: EPOCH,
            evidence: { sourceInstitution: 'BANK_B', evidenceType: 'PAYMENT_EVENT', observedAt: EPOCH, tenantScope: 'NETWORK', linkage: 'CORRELATED', scoring: 'CONFIRMED' },
          },
        ],
      });
      expect(response.status).toBe(400);
      expect(response.body.problems).toEqual(['edges[0].evidence.scoring must be CANDIDATE for CORRELATED']);
    });
  });
});
