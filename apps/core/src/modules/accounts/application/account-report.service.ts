import type { Account, BankAccountReport } from '@sentinel/domain';
import type { PolicyConfiguration } from '../../policy/application/ports/policy-configuration.port.js';
import type { AccountRepository } from './ports/account-repository.port.js';
import type { RecordBankAccountReport } from './record-bank-account-report.use-case.js';

export class AccountReportService implements RecordBankAccountReport {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly policy: PolicyConfiguration,
  ) {}

  applyReport(report: BankAccountReport): Promise<Account> {
    return this.accounts.applyBankReport(report, report.balance >= this.policy.rapidDrainPolicy().protectedBalance);
  }
}
