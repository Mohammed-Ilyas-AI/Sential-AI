import { TRANSACTION_TAPE_MAX_ROWS, type DecisionRecord, type StreamCursor } from '@sentinel/domain';
import { createFeature, createReducer, on } from '@ngrx/store';
import { processTransactionBatch } from '../../workers/transaction-batch.processor';
import type { AccountRisk, TapeRow } from '../../workers/transaction-worker-protocol';
import { TransactionsActions } from './transactions.actions';

/** Updated once per 250 ms worker batch, never once per transaction. */
export interface TransactionsState {
  readonly tape: readonly TapeRow[];
  readonly latestByAccount: Readonly<Record<string, DecisionRecord>>;
  readonly lastCursor: StreamCursor | null;
}

const initialTransactionsState: TransactionsState = { tape: [], latestByAccount: {}, lastCursor: null };

function mergeTape(incoming: readonly TapeRow[], existing: readonly TapeRow[]): readonly TapeRow[] {
  const seen = new Set<string>();
  return [...incoming, ...existing]
    .filter((row) => (seen.has(row.transactionId) ? false : (seen.add(row.transactionId), true)))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, TRANSACTION_TAPE_MAX_ROWS);
}

function mergeAccounts(
  current: Readonly<Record<string, DecisionRecord>>,
  accounts: readonly AccountRisk[],
): Readonly<Record<string, DecisionRecord>> {
  const next = { ...current };
  for (const { accountId, latest } of accounts) {
    const known = next[accountId];
    if (!known || latest.occurredAt >= known.occurredAt) next[accountId] = latest;
  }
  return next;
}

export const transactionsFeature = createFeature({
  name: 'transactions',
  reducer: createReducer(
    initialTransactionsState,
    on(TransactionsActions.snapshotLoaded, (_state, { decisions, cursor }) => {
      const processed = processTransactionBatch(decisions);
      return {
        tape: mergeTape(processed.rows, []),
        latestByAccount: mergeAccounts({}, processed.accounts),
        lastCursor: cursor,
      };
    }),
    on(TransactionsActions.batchProcessed, (state, { rows, accounts }) => ({
      ...state,
      tape: mergeTape(rows, state.tape),
      latestByAccount: mergeAccounts(state.latestByAccount, accounts),
    })),
  ),
});
