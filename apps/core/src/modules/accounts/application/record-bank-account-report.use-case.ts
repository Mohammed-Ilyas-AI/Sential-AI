import type { Account, BankAccountReport } from '@sentinel/domain';

export interface RecordBankAccountReport {
  applyReport(report: BankAccountReport): Promise<Account>;
}
