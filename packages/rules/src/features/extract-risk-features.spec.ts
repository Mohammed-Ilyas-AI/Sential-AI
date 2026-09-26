import type { AccountState } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import { EVALUATED_AT, accountFixture } from '../testing/risk-inputs.fixture.js';
import { extractRiskFeatures } from './extract-risk-features.js';

const securityState = (overrides: Partial<AccountState> = {}): AccountState => ({
  accountId: 'acct_tok_fixture01',
  deviceFirstSeenAt: {},
  payeeFirstSeenAt: {},
  ...overrides,
});

const extract = (deviceToken: string | null, payeeToken: string | null, state: AccountState | null) =>
  extractRiskFeatures({ deviceToken, payeeToken, account: accountFixture(), securityState: state, flaggedLinks: [], evaluatedAt: EVALUATED_AT });

describe('extractRiskFeatures', () => {
  it('ages a device and payee from their first-seen records', () => {
    const features = extract(
      'dev_tok_new',
      'ben_tok_new',
      securityState({
        deviceFirstSeenAt: { dev_tok_new: '2026-09-24T11:30:30.000Z' },
        payeeFirstSeenAt: { ben_tok_new: '2026-09-24T10:30:45.000Z' },
      }),
    );
    expect(features.deviceAgeHours).toBeCloseTo(15 / 3600, 6);
    expect(features.payeeAgeHours).toBe(1);
  });

  it('treats a device or payee the bank reports as established as not new', () => {
    const features = extract('dev_tok_known001', 'ben_tok_known001', null);
    expect(features.deviceAgeHours).toBeNull();
    expect(features.payeeAgeHours).toBeNull();
  });

  it('treats a never-seen device or payee as first seen now', () => {
    const features = extract('dev_tok_unseen', 'ben_tok_unseen', null);
    expect(features.deviceAgeHours).toBe(0);
    expect(features.payeeAgeHours).toBe(0);
  });

  it('reports no device age when the transaction carries no device', () => {
    expect(extract(null, 'ben_tok_known001', null).deviceAgeHours).toBeNull();
  });

  it('marks cooling-off active only while its window is in the future', () => {
    expect(extract(null, null, securityState({ coolingOffUntil: '2026-09-24T20:00:00.000Z' })).coolingOffActive).toBe(true);
    expect(extract(null, null, securityState({ coolingOffUntil: '2026-09-24T09:00:00.000Z' })).coolingOffActive).toBe(false);
  });

  it('takes velocity ratio and 95th-percentile amount from the reported behaviour', () => {
    const features = extract(null, null, null);
    expect(features.velocityRatio).toBe(1);
    expect(features.amountP95).toBe(300_000);
  });
});
