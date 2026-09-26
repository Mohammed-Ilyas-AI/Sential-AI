import type { Account, AccountState, BankAccountReport } from '@sentinel/domain';
import type { Collection } from 'mongodb';
import type { AccountRepository } from '../../../../modules/accounts/application/ports/account-repository.port.js';
import type { AccountSecurityStateRepository } from '../../../../modules/accounts/application/ports/account-security-state-repository.port.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import { accountsCollection, type AccountDocument } from '../collections/accounts.collection.js';

/** One document per account holds the bank's report and, separately, the security state. */
export class MongoAccountStateRepository implements AccountRepository, AccountSecurityStateRepository {
  private readonly accounts: Collection<AccountDocument>;

  constructor(database: MongoDatabase) {
    this.accounts = database.collection<AccountDocument>(accountsCollection.name);
  }

  async findAccount(accountId: string): Promise<Account | null> {
    const document = await this.accounts.findOne({ _id: accountId });
    if (!document) return null;
    const { _id, tenantId, securityState, coolingOffUntil, ...account } = document;
    const activeCoolingOff = securityState?.coolingOffUntil ?? coolingOffUntil;
    return { ...account, ...(activeCoolingOff ? { coolingOffUntil: activeCoolingOff } : {}) };
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
    await this.accounts.updateOne(
      { _id: account.id },
      { $set: { ...account, tenantId: report.tenantId } },
      { upsert: true },
    );
    return (await this.findAccount(account.id)) ?? account;
  }

  async findSecurityState(accountId: string): Promise<AccountState | null> {
    const document = await this.accounts.findOne({ _id: accountId }, { projection: { securityState: 1 } });
    return document?.securityState ?? null;
  }

  async saveSecurityState(state: AccountState): Promise<void> {
    await this.accounts.updateOne({ _id: state.accountId }, { $set: { securityState: state } });
  }
}
