import type { Account, AccountState, BankAccountReport } from '@sentinel/domain';
import type { AccountRepository } from '../../../src/modules/accounts/application/ports/account-repository.port.js';
import type { AccountSecurityStateRepository } from '../../../src/modules/accounts/application/ports/account-security-state-repository.port.js';

export class InMemoryAccountStateRepository implements AccountRepository, AccountSecurityStateRepository {
  private readonly accounts = new Map<string, Account>();
  private readonly securityStates = new Map<string, AccountState>();

  async findAccount(accountId: string): Promise<Account | null> {
    const account = this.accounts.get(accountId);
    if (!account) return null;
    const coolingOffUntil = this.securityStates.get(accountId)?.coolingOffUntil;
    return coolingOffUntil ? { ...account, coolingOffUntil } : account;
  }

  async applyBankReport(report: BankAccountReport, isProtected: boolean): Promise<Account> {
    const account: Account = {
      id: report.accountToken,
      institutionId: report.institutionId,
      balance: report.balance,
      balanceAsOf: report.balanceAsOf,
      openedAt: report.openedAt,
      knownDeviceIds: [...report.knownDeviceTokens],
      knownPayeeIds: [...report.knownPayeeTokens],
      protected: isProtected,
      displayReference: report.displayReference,
      behaviour: report.behaviour,
    };
    this.accounts.set(account.id, account);
    return (await this.findAccount(account.id)) ?? account;
  }

  async findSecurityState(accountId: string): Promise<AccountState | null> {
    return this.securityStates.get(accountId) ?? null;
  }

  async saveSecurityState(state: AccountState): Promise<void> {
    if (this.accounts.has(state.accountId)) this.securityStates.set(state.accountId, state);
  }
}
