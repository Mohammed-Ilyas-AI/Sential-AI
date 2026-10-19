import type { AuditEvent, CustomerContactRecord, DecisionRequest, DecisionResponse, Intervention, KillSwitchRecord, KillSwitchStatus, TransactionType } from '@sentinel/domain';
import { ScenarioEventFactory, SYNTHETIC_ACCOUNTS, syntheticToken, type SyntheticAccount } from '@sentinel/scenarios';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startCoreHarness, type CoreHarness } from '../support/harness/core-test-harness.js';
import { callJson } from '../support/harness/http-bank-connector.js';
import { createInMemoryPersistence, type InMemoryPersistence } from '../support/in-memory-repositories/in-memory-persistence.js';

const EPOCH = '2026-09-24T11:30:00.000Z';
const HOUR_MS = 3_600_000;
const ACCOUNT = SYNTHETIC_ACCOUNTS.find((candidate) => candidate.displayId === 'ACC-10291') as SyntheticAccount;
const TOKEN = syntheticToken('acct', ACCOUNT.displayId);
const BILLER = 'SP-UTILITIES';
const ANALYST = 'analyst.tan';

type Written<TRecord> = { outcome: 'CREATED' | 'DUPLICATE'; record: TRecord };

/**
 * The analyst exceptions besides fraud confirmation (M§5.3): the account kill switch, enforced in the decision
 * path, and the recorded customer contact. Neither lets an analyst release a hold on judgement.
 */
describe('Account kill switch and customer contact', () => {
  let persistence: InMemoryPersistence;
  let harness: CoreHarness;
  let events: ScenarioEventFactory;

  const call = <T>(method: string, path: string, body?: unknown, lens?: string) =>
    callJson<T>(harness.baseUrl, method, path, body, lens ? { 'x-sentinel-lens': lens } : {});
  const decideAt = async (request: DecisionRequest) => {
    harness.clock.set(request.occurredAt);
    return (await call<DecisionResponse>('POST', '/v1/decision/transactions', request)).body;
  };
  const outflow = (amount: number, occurredAt: string, type: TransactionType = 'TRANSFER', payeeId = 'PAYEE-2251') =>
    events.transfer({ source: ACCOUNT, payeeId, destinationInstitutionId: 'BANK_A', amount, deviceId: events.homeDevice(ACCOUNT), occurredAt, type });
  const activate = (idempotencyKey: string, overrides: Record<string, unknown> = {}, lens?: string) =>
    call<Written<KillSwitchRecord>>(
      'POST',
      `/v1/accounts/${TOKEN}/kill-switch`,
      { analystIdentity: ANALYST, reason: 'Customer reports phone stolen', idempotencyKey, confirmAccountId: TOKEN, ...overrides },
      lens,
    );

  beforeEach(async () => {
    persistence = createInMemoryPersistence();
    harness = await startCoreHarness(persistence, { clockStart: EPOCH, designatedBillingPayeeIds: new Set([syntheticToken('ben', BILLER)]) });
    events = new ScenarioEventFactory('CONTROLS', Date.parse(EPOCH));
    await call('PUT', `/v1/accounts/${TOKEN}`, events.accountReport(ACCOUNT, 5_200_000, 1, EPOCH));
  });
  afterEach(() => harness.close());

  describe('kill switch', () => {
    it('needs a reason, an analyst and the second confirmation step naming the same account', async () => {
      expect((await activate('k-1', { reason: undefined })).status).toBe(400);
      expect((await activate('k-1', { analystIdentity: undefined })).status).toBe(400);
      expect((await activate('k-1', { confirmAccountId: 'acct_someone_else' })).status).toBe(422);
      expect((await call<KillSwitchStatus>('GET', `/v1/accounts/${TOKEN}/kill-switch`)).body.active).toBe(false);
    });

    it('holds every eligible outflow server-side with its own reason, no auto-release and an unchanged score', async () => {
      const before = await decideAt(outflow(10_000, events.at(0)).request);
      expect(before.decision).toBe('ALLOW');

      const activated = await activate('k-1');
      expect(activated.status).toBe(201);
      expect(activated.body.record).toMatchObject({ state: 'ACTIVE', previousState: 'NONE', actor: 'ANALYST', actorIdentity: ANALYST });

      const held = await decideAt(outflow(10_000, events.at(HOUR_MS)).request);
      expect(held).toMatchObject({ decision: 'HOLD', policyCodes: ['KILL_SWITCH'], reasonCodes: ['ANALYST_KILL_SWITCH'] });
      expect(held.holdUntil).toBeUndefined();
      expect(held.riskScore).toBe(before.riskScore);

      const [hold] = (await call<{ history: Intervention[] }>('GET', `/v1/interventions/${held.transactionId}`)).body.history;
      expect(hold).toMatchObject({ state: 'HELD', actor: 'SYSTEM', reasonCodes: ['ANALYST_KILL_SWITCH'] });
      expect(hold?.holdUntil).toBeUndefined();

      harness.clock.set(events.at(48 * HOUR_MS));
      expect(await harness.controlPath.interventions.releaseDueHolds(harness.clock.now().toISOString())).toBe(0);
      const released = await call<Intervention>('POST', `/v1/interventions/${held.transactionId}/customer-verified-release`);
      expect(released.body).toMatchObject({ state: 'RELEASED', actor: 'CUSTOMER', reasonCodes: ['CUSTOMER_VERIFIED_RELEASE'] });
    });

    it('keeps the documented exclusions outside the switch', async () => {
      await activate('k-1');
      const bill = await decideAt(outflow(40_000, events.at(HOUR_MS), 'BILL', BILLER).request);
      expect(bill).toMatchObject({ decision: 'ALLOW', reasonCodes: ['SG-RD-50_EXCLUDED'] });
    });

    it('answers a retry with the stored record and refuses a second activation while active', async () => {
      const first = await activate('k-1');
      const retry = await activate('k-1');
      expect(retry.status).toBe(200);
      expect(retry.body).toEqual({ outcome: 'DUPLICATE', record: first.body.record });
      expect((await activate('k-2')).status).toBe(409);
      expect((await call<KillSwitchStatus>('GET', `/v1/accounts/${TOKEN}/kill-switch`)).body.history).toHaveLength(1);
    });

    it('keeps a threshold hold already in force past its cooling period while the switch is active', async () => {
      const breach = await decideAt(outflow(3_000_000, events.at(0)).request);
      expect(breach).toMatchObject({ decision: 'HOLD', holdUntil: expect.any(String) });
      await activate('k-1');

      harness.clock.set(events.at(25 * HOUR_MS));
      expect(await harness.controlPath.interventions.releaseDueHolds(harness.clock.now().toISOString())).toBe(0);
      const history = (await call<{ history: Intervention[] }>('GET', `/v1/interventions/${breach.transactionId}`)).body.history;
      expect(history.at(-1)?.state).toBe('HELD');

      await call('POST', `/v1/accounts/${TOKEN}/kill-switch/customer-verified-release`, { idempotencyKey: 'v-1' });
      expect(await harness.controlPath.interventions.releaseDueHolds(harness.clock.now().toISOString())).toBe(1);
    });

    it('lifts only on customer verification; afterwards outflows are decided by the policy alone', async () => {
      expect((await call('POST', `/v1/accounts/${TOKEN}/kill-switch/customer-verified-release`, { idempotencyKey: 'v-0' })).status).toBe(409);
      await activate('k-1');
      const lifted = await call<Written<KillSwitchRecord>>('POST', `/v1/accounts/${TOKEN}/kill-switch/customer-verified-release`, { idempotencyKey: 'v-1' });
      expect(lifted.status).toBe(201);
      expect(lifted.body.record).toMatchObject({ state: 'LIFTED', previousState: 'ACTIVE', actor: 'CUSTOMER' });
      expect((await decideAt(outflow(10_000, events.at(HOUR_MS)).request)).decision).toBe('ALLOW');
      const audit = persistence.auditLog.all().map((event) => event.action);
      expect(audit).toEqual(['KILL_SWITCH_ACTIVATED', 'KILL_SWITCH_LIFTED_AFTER_CUSTOMER_VERIFICATION']);
    });
  });

  describe('contact customer', () => {
    const contact = (idempotencyKey: string, overrides: Record<string, unknown> = {}) =>
      call<Written<CustomerContactRecord>>('POST', `/v1/accounts/${TOKEN}/customer-contacts`, {
        analystIdentity: ANALYST,
        channel: 'PHONE',
        outcome: 'NO_ANSWER',
        note: 'Second attempt; voicemail full',
        idempotencyKey,
        ...overrides,
      });

    it('records an attempt once, marked simulated, visible in the account history and audited without the note', async () => {
      const first = await contact('c-1');
      expect(first.status).toBe(201);
      expect(first.body.record).toMatchObject({ channel: 'PHONE', outcome: 'NO_ANSWER', actorIdentity: ANALYST, simulated: true });
      expect((await contact('c-1')).body).toEqual({ outcome: 'DUPLICATE', record: first.body.record });
      const listed = await call<{ contacts: CustomerContactRecord[] }>('GET', `/v1/accounts/${TOKEN}/customer-contacts`);
      expect(listed.body.contacts.map((record) => record.id)).toEqual([first.body.record.id]);
      const [audited] = persistence.auditLog.all();
      expect(audited).toMatchObject({ category: 'CUSTOMER_CONTACT', action: 'CUSTOMER_CONTACT_NO_ANSWER', actorIdentity: ANALYST });
      expect(JSON.stringify(audited)).not.toContain('voicemail');
    });

    it('rejects an unknown channel or outcome, and an unknown account', async () => {
      expect((await contact('c-1', { channel: 'CARRIER_PIGEON' })).status).toBe(400);
      expect((await contact('c-1', { outcome: 'MAYBE' })).status).toBe(400);
      expect((await call('GET', '/v1/accounts/acct_unknown/customer-contacts')).status).toBe(404);
    });
  });

  describe('tenant lens', () => {
    it('lets the owning institution act and refuses another, auditing the refusal', async () => {
      expect((await activate('k-1', {}, 'BANK_B')).status).toBe(403);
      expect((await call('GET', `/v1/accounts/${TOKEN}/customer-contacts`, undefined, 'BANK_C')).status).toBe(403);
      expect((await activate('k-1', {}, 'BANK_A')).status).toBe(201);
      const denied = persistence.auditLog.all().filter((event) => event.outcome === 'DENIED');
      expect(denied.map((event) => [event.action, event.lens, event.subject.institutionId])).toEqual([
        ['CROSS_TENANT_DENIED', 'BANK_B', 'BANK_A'],
        ['CROSS_TENANT_DENIED', 'BANK_C', 'BANK_A'],
      ]);
    });

    it('refuses an unknown lens rather than falling back to the operator view', async () => {
      expect((await call('GET', `/v1/accounts/${TOKEN}/kill-switch`, undefined, 'BANK_Z')).status).toBe(400);
    });

    it('scopes the audit events to the lens institution', async () => {
      await activate('k-1');
      await call('GET', `/v1/accounts/${TOKEN}/kill-switch`, undefined, 'BANK_B');
      const ownView = await call<{ events: AuditEvent[] }>('GET', '/v1/audit-events', undefined, 'BANK_A');
      expect(ownView.body.events.map((event) => event.action).sort()).toEqual(['CROSS_TENANT_DENIED', 'KILL_SWITCH_ACTIVATED']);
      const otherView = await call<{ events: AuditEvent[] }>('GET', '/v1/audit-events', undefined, 'BANK_C');
      expect(otherView.body.events).toEqual([]);
    });

    it('applies to the existing intervention routes too', async () => {
      await activate('k-1');
      const held = await decideAt(outflow(10_000, events.at(HOUR_MS)).request);
      expect((await call('GET', `/v1/interventions/${held.transactionId}`, undefined, 'BANK_B')).status).toBe(403);
      expect((await call('POST', `/v1/interventions/${held.transactionId}/customer-verified-release`, undefined, 'BANK_B')).status).toBe(403);
      expect((await call<{ history: Intervention[] }>('GET', `/v1/interventions/${held.transactionId}`)).body.history.at(-1)?.state).toBe('HELD');
    });
  });
});
