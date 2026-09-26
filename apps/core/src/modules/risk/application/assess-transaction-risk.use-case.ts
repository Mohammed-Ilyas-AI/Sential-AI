import type { Account, RecordedRiskAssessment, Transaction, WindowContext } from '@sentinel/domain';

export interface AssessTransactionRisk {
  assessAndRecord(transaction: Transaction, account: Account, window: WindowContext): Promise<RecordedRiskAssessment>;
}
