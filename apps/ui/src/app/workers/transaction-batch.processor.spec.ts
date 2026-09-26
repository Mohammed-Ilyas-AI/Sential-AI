import { describe, expect, it } from 'vitest';
import { decisionRecord, demoFinalDecision, demoThirdDecision } from '../../testing/ui-fixtures';
import { processTransactionBatch } from './transaction-batch.processor';

describe('processTransactionBatch', () => {
  it('turns decisions into tape rows carrying amount, account, score, band and decision', () => {
    const { rows } = processTransactionBatch([demoFinalDecision()]);
    expect(rows).toEqual([
      expect.objectContaining({
        transactionId: 'txn_demo_final',
        accountReference: 'ACC-10291',
        amount: 1_150_000,
        score: 95,
        band: 'CRITICAL',
        decision: 'HOLD',
        institutionId: 'BANK_A',
        destinationInstitutionId: 'BANK_C',
      }),
    ]);
  });

  it('reports each changed account once, with its newest decision', () => {
    const other = decisionRecord({ transactionId: 'txn_other' });
    const { accounts } = processTransactionBatch([demoFinalDecision(), other, demoThirdDecision()]);
    expect(accounts.map((account) => [account.accountId, account.latest.transactionId])).toEqual([
      [demoFinalDecision().accountId, 'txn_demo_final'],
      [other.accountId, 'txn_other'],
    ]);
  });
});
