import type { Account, DrainState, RiskFeatures, Transaction, WindowContext } from '@sentinel/domain';

export const EVALUATED_AT = '2026-09-24T11:30:45.000Z';

export function accountFixture(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acct_tok_fixture01',
    institutionId: 'BANK_A',
    balance: 5_200_000,
    balanceAsOf: '2026-09-23T11:30:00.000Z',
    openedAt: '2021-01-12T00:00:00.000Z',
    knownDeviceIds: ['dev_tok_known001'],
    knownPayeeIds: ['ben_tok_known001'],
    protected: true,
    behaviour: { velocityRatio: 1, amountP95: 300_000, observedAt: EVALUATED_AT },
    ...overrides,
  };
}

export function transactionFixture(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'TX-fixture-0001',
    ts: EVALUATED_AT,
    sourceAccountId: 'acct_tok_fixture01',
    destAccountId: 'acct_tok_fixture02',
    payeeId: 'ben_tok_fixture02',
    deviceId: 'dev_tok_fixture01',
    amount: 100_000,
    channel: 'APP',
    type: 'TRANSFER',
    institutionId: 'BANK_A',
    destInstitutionId: 'BANK_B',
    ...overrides,
  };
}

export function drainFixture(drainPct: number, overrides: Partial<DrainState> = {}): DrainState {
  return {
    balanceAtWindowStart: 5_200_000,
    outflow24h: Math.round((5_200_000 * drainPct) / 100),
    drainPct,
    thresholdMet: drainPct > 50,
    excluded: false,
    ...overrides,
  };
}

export function featuresFixture(overrides: Partial<RiskFeatures> = {}): RiskFeatures {
  return {
    evaluatedAt: EVALUATED_AT,
    deviceAgeHours: null,
    deviceToken: 'dev_tok_fixture01',
    payeeAgeHours: null,
    payeeToken: 'ben_tok_fixture02',
    velocityRatio: 1,
    amountP95: 300_000,
    coolingOffActive: false,
    flaggedLinks: [],
    ...overrides,
  };
}

export function windowFixture(
  options: { readonly drain?: DrainState; readonly features?: Partial<RiskFeatures> } = {},
): WindowContext {
  return {
    accountId: 'acct_tok_fixture01',
    windowStart: '2026-09-23T11:30:45.000Z',
    balance24hAgo: 5_200_000,
    outflow24h: 0,
    drain: options.drain ?? drainFixture(0),
    features: featuresFixture(options.features),
  };
}
