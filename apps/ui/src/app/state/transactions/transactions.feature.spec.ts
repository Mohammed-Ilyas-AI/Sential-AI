import { TRANSACTION_TAPE_MAX_ROWS } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import { decisionRecord, demoFinalDecision, demoThirdDecision } from '../../../testing/ui-fixtures';
import { processTransactionBatch } from '../../workers/transaction-batch.processor';
import { TransactionsActions } from './transactions.actions';
import { transactionsFeature } from './transactions.feature';

const reduce = transactionsFeature.reducer;
const initial = reduce(undefined, { type: '@@init' });

function batch(...decisions: Parameters<typeof processTransactionBatch>[0]) {
  const { rows, accounts } = processTransactionBatch(decisions);
  return TransactionsActions.batchProcessed({ rows, accounts });
}

describe('transactions feature', () => {
  it('keeps the tape newest first and each account on its latest decision', () => {
    const state = reduce(reduce(initial, batch(demoThirdDecision())), batch(demoFinalDecision()));
    expect(state.tape.map((row) => row.transactionId)).toEqual(['txn_demo_final', 'txn_demo_third']);
    expect(state.latestByAccount[demoFinalDecision().accountId]?.transactionId).toBe('txn_demo_final');
  });

  it('never lets an older decision replace a newer one for the same account', () => {
    const state = reduce(reduce(initial, batch(demoFinalDecision())), batch(demoThirdDecision()));
    expect(state.latestByAccount[demoFinalDecision().accountId]?.transactionId).toBe('txn_demo_final');
  });

  it('shows a redelivered decision once', () => {
    const state = reduce(reduce(initial, batch(demoFinalDecision())), batch(demoFinalDecision()));
    expect(state.tape).toHaveLength(1);
  });

  it(`caps the tape at ${TRANSACTION_TAPE_MAX_ROWS} rows`, () => {
    const many = Array.from({ length: TRANSACTION_TAPE_MAX_ROWS + 25 }, (_, index) =>
      decisionRecord({
        transactionId: `txn_${index}`,
        occurredAt: new Date(Date.UTC(2026, 8, 24, 1, 0, index)).toISOString(),
      }),
    );
    const state = reduce(initial, batch(...many));
    expect(state.tape).toHaveLength(TRANSACTION_TAPE_MAX_ROWS);
    expect(state.tape[0]?.transactionId).toBe(`txn_${TRANSACTION_TAPE_MAX_ROWS + 24}`);
  });

  it('replaces everything with the server snapshot', () => {
    const withStale = reduce(initial, batch(decisionRecord({ transactionId: 'txn_stale' })));
    const state = reduce(
      withStale,
      TransactionsActions.snapshotLoaded({ decisions: [demoThirdDecision(), demoFinalDecision()], cursor: 'cursor-1' }),
    );
    expect(state.tape.map((row) => row.transactionId)).toEqual(['txn_demo_final', 'txn_demo_third']);
    expect(state.lastCursor).toBe('cursor-1');
  });
});
