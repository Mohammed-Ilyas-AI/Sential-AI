import { describe, expect, it } from 'vitest';
import { decisionRecord, demoFinalDecision, demoThirdDecision } from '../../../testing/ui-fixtures';
import { processTransactionBatch } from '../../workers/transaction-batch.processor';
import { STATIC_COMMANDS, matchingStaticCommands, recordCommands } from './palette-commands';

const rows = processTransactionBatch([demoFinalDecision(), demoThirdDecision(), decisionRecord({ transactionId: 'txn_other' })]).rows;

describe('palette commands', () => {
  it('finds an account on the tape by its reference, once, with its latest score', () => {
    const results = recordCommands('10291', rows);
    expect(results.filter((command) => command.group === 'Accounts')).toEqual([
      expect.objectContaining({ label: 'ACC-10291', hint: 'score 95 · critical', action: { kind: 'focus-account', accountId: demoFinalDecision().accountId } }),
    ]);
  });

  it('finds a transaction by id and focuses its account', () => {
    const [transaction] = recordCommands('txn_demo_f', rows).filter((command) => command.group === 'Transactions');
    expect(transaction).toMatchObject({ label: 'txn_demo_final', hint: 'HOLD · ACC-10291' });
  });

  it('needs two characters before searching records', () => {
    expect(recordCommands('a', rows)).toEqual([]);
  });

  it('filters workspace commands by label and keyword, and lists all when empty', () => {
    expect(matchingStaticCommands('')).toBe(STATIC_COMMANDS);
    expect(matchingStaticCommands('sg-rd').map((command) => command.id)).toEqual(['open-policy']);
    expect(matchingStaticCommands('sidebar').map((command) => command.id)).toEqual(['toggle-sidebar']);
  });
});
