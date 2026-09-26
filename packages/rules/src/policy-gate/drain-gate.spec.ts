import { DEFAULT_RAPID_DRAIN_POLICY, type DesignatedBillingOrganisations, type RollingWindow } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import { transactionFixture } from '../testing/risk-inputs.fixture.js';
import { drainGate } from './drain-gate.js';

const billers: DesignatedBillingOrganisations = { isDesignated: (payeeId) => payeeId === 'ben_tok_utility' };

const window = (balance24hAgo: number, outflow24h: number): RollingWindow => ({
  accountId: 'acct_tok_fixture01',
  windowStart: '2026-09-23T11:30:45.000Z',
  balance24hAgo,
  outflow24h,
});

describe('drainGate() — SG-RD-50', () => {
  it('excludes STANDING and GIRO transactions entirely', () => {
    for (const type of ['STANDING', 'GIRO'] as const) {
      const drain = drainGate(transactionFixture({ type, amount: 5_000_000 }), window(5_200_000, 0), DEFAULT_RAPID_DRAIN_POLICY, billers);
      expect(drain).toMatchObject({ excluded: true, exclusionReason: type, thresholdMet: false, outflow24h: 0 });
    }
  });

  it('excludes BILL payments to a designated billing organisation, but not to any other payee', () => {
    const toBiller = drainGate(
      transactionFixture({ type: 'BILL', payeeId: 'ben_tok_utility', amount: 3_000_000 }),
      window(5_200_000, 0),
      DEFAULT_RAPID_DRAIN_POLICY,
      billers,
    );
    const toOther = drainGate(
      transactionFixture({ type: 'BILL', payeeId: 'ben_tok_other', amount: 3_000_000 }),
      window(5_200_000, 0),
      DEFAULT_RAPID_DRAIN_POLICY,
      billers,
    );
    expect(toBiller).toMatchObject({ excluded: true, exclusionReason: 'BILL_ORG', thresholdMet: false });
    expect(toOther).toMatchObject({ excluded: false, thresholdMet: true });
  });

  it('does not protect an account below 5_000_000 at window start', () => {
    const drain = drainGate(transactionFixture({ amount: 4_000_000 }), window(4_999_999, 0), DEFAULT_RAPID_DRAIN_POLICY, billers);
    expect(drain.thresholdMet).toBe(false);
    expect(drain.drainPct).toBeGreaterThan(50);
  });

  it('protects an account at exactly 5_000_000', () => {
    const drain = drainGate(transactionFixture({ amount: 2_500_001 }), window(5_000_000, 0), DEFAULT_RAPID_DRAIN_POLICY, billers);
    expect(drain.thresholdMet).toBe(true);
  });

  it('includes the evaluated amount in outflow24h', () => {
    const drain = drainGate(transactionFixture({ amount: 1_150_000 }), window(5_200_000, 2_250_000), DEFAULT_RAPID_DRAIN_POLICY, billers);
    expect(drain.outflow24h).toBe(3_400_000);
    expect(drain.drainPct.toFixed(1)).toBe('65.4');
    expect(drain.thresholdMet).toBe(true);
  });

  it('does not meet the threshold at exactly 50%', () => {
    const drain = drainGate(transactionFixture({ amount: 100_000 }), window(5_200_000, 2_500_000), DEFAULT_RAPID_DRAIN_POLICY, billers);
    expect(drain.drainPct).toBe(50);
    expect(drain.thresholdMet).toBe(false);
  });

  it('meets the threshold one cent above 50%', () => {
    const drain = drainGate(transactionFixture({ amount: 100_001 }), window(5_200_000, 2_500_000), DEFAULT_RAPID_DRAIN_POLICY, billers);
    expect(drain.thresholdMet).toBe(true);
  });

  it('keeps holding subsequent outflows once cumulative outflow is over the gate', () => {
    const drain = drainGate(transactionFixture({ amount: 100 }), window(5_200_000, 3_400_000), DEFAULT_RAPID_DRAIN_POLICY, billers);
    expect(drain.thresholdMet).toBe(true);
  });

  it('reads thresholds from policy configuration, not literals', () => {
    const stricter = { ...DEFAULT_RAPID_DRAIN_POLICY, gatePercent: 40, policyVersion: 'SG-RD-test' };
    const drain = drainGate(transactionFixture({ amount: 100_000 }), window(5_200_000, 2_000_000), stricter, billers);
    expect(drain.thresholdMet).toBe(true);
  });
});
