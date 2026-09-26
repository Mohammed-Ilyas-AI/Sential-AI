import type { BankAccountReport } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import type { AccountRepository } from '../../src/modules/accounts/application/ports/account-repository.port.js';
import type { AccountSecurityStateRepository } from '../../src/modules/accounts/application/ports/account-security-state-repository.port.js';

const report = (overrides: Partial<BankAccountReport> = {}): BankAccountReport => ({
  schemaVersion: '1.0',
  tenantId: 'BANK_A',
  accountToken: 'acct_tok_contract1',
  institutionId: 'BANK_A',
  displayReference: 'ACC-CONTRACT',
  openedAt: '2021-01-12T00:00:00.000Z',
  balance: 5_200_000,
  balanceAsOf: '2026-09-23T10:00:00.000Z',
  knownDeviceTokens: ['dev_tok_contract1'],
  knownPayeeTokens: ['ben_tok_contract1'],
  behaviour: { velocityRatio: 1, amountP95: 300_000, observedAt: '2026-09-24T10:00:00.000Z' },
  ...overrides,
});

/** Financial account state and security state live side by side but are read and written separately. */
export function describeAccountStateContract(
  adapterName: string,
  createRepository: () => (AccountRepository & AccountSecurityStateRepository) | Promise<AccountRepository & AccountSecurityStateRepository>,
): void {
  describe(`Account state contract: ${adapterName}`, () => {
    it('records a bank report and reads the account back', async () => {
      const repository = await createRepository();
      const account = await repository.applyBankReport(report(), true);
      expect(account).toMatchObject({ id: 'acct_tok_contract1', balance: 5_200_000, protected: true, displayReference: 'ACC-CONTRACT' });
      expect(await repository.findAccount('acct_tok_contract1')).toEqual(account);
      expect(await repository.findAccount('acct_tok_missing')).toBeNull();
    });

    it('replaces the report on a later report without touching security state', async () => {
      const repository = await createRepository();
      await repository.applyBankReport(report(), true);
      await repository.saveSecurityState({ accountId: 'acct_tok_contract1', deviceFirstSeenAt: { dev_tok_new: '2026-09-24T10:00:30.000Z' }, payeeFirstSeenAt: {} });
      await repository.applyBankReport(report({ behaviour: { velocityRatio: 5.5, amountP95: 300_000, observedAt: '2026-09-24T10:00:45.000Z' } }), true);
      expect((await repository.findAccount('acct_tok_contract1'))?.behaviour.velocityRatio).toBe(5.5);
      expect((await repository.findSecurityState('acct_tok_contract1'))?.deviceFirstSeenAt).toEqual({ dev_tok_new: '2026-09-24T10:00:30.000Z' });
    });

    it('surfaces an active cooling-off from security state on the account', async () => {
      const repository = await createRepository();
      await repository.applyBankReport(report(), true);
      await repository.saveSecurityState({
        accountId: 'acct_tok_contract1',
        coolingOffUntil: '2026-09-24T22:00:00.000Z',
        deviceFirstSeenAt: {},
        payeeFirstSeenAt: {},
      });
      expect((await repository.findAccount('acct_tok_contract1'))?.coolingOffUntil).toBe('2026-09-24T22:00:00.000Z');
    });
  });
}
