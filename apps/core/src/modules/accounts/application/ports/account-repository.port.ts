import type { Account, BankAccountReport } from '@sentinel/domain';

/** `accounts`: the bank-reported balance, established devices and payees, and behavioural baselines. */
export interface AccountRepository {
  findAccount(accountId: string): Promise<Account | null>;
  applyBankReport(report: BankAccountReport, isProtected: boolean): Promise<Account>;
}
