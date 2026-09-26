import { describe, it } from 'vitest';

describe('ScenarioRunner', () => {
  it.todo('records LOGIN_NEW_DEVICE and ADD_PAYEE through POST /v1/events/security before any later transfer');
  it.todo('calls POST /v1/decision/transactions before publishing any lifecycle event for a transfer');
  it.todo('publishes SETTLED only for an ALLOW decision, and nothing further for a HOLD');
  it.todo('publishes with sourceAccountToken as the ordering key');
  it.todo('reuses the idempotencyKey on retry');
});
