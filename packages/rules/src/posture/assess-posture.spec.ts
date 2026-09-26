import { DEFAULT_RAPID_DRAIN_POLICY, type AccountState } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import { RISK_RULES } from '../risk-engine/rule-registry.js';
import { EVALUATED_AT, accountFixture } from '../testing/risk-inputs.fixture.js';
import { assessPosture } from './assess-posture.js';

const window = { accountId: 'acct_tok_fixture01', windowStart: '2026-09-23T11:30:45.000Z', balance24hAgo: 5_200_000, outflow24h: 800_000 };

const postureWith = (securityState: AccountState) =>
  assessPosture({ account: accountFixture(), securityState, window, policy: DEFAULT_RAPID_DRAIN_POLICY, evaluatedAt: EVALUATED_AT, rules: RISK_RULES });

describe('assessPosture — the pre-transfer climb', () => {
  it('scores 21 after a login from an unseen device', () => {
    const posture = postureWith({
      accountId: 'acct_tok_fixture01',
      newDeviceAt: '2026-09-24T11:30:30.000Z',
      deviceFirstSeenAt: { dev_tok_7f3a: '2026-09-24T11:30:30.000Z' },
      payeeFirstSeenAt: {},
    });
    expect(posture.score).toBe(21);
    expect(posture.contributions.map((contribution) => contribution.code)).toEqual(['NEW_DEVICE']);
  });

  it('scores 37 once a new payee is added', () => {
    const posture = postureWith({
      accountId: 'acct_tok_fixture01',
      deviceFirstSeenAt: { dev_tok_7f3a: '2026-09-24T11:30:30.000Z' },
      payeeFirstSeenAt: { ben_tok_9281: '2026-09-24T11:30:34.000Z' },
    });
    expect(posture.score).toBe(37);
    expect(posture.band).toBe('LOW');
  });
});
