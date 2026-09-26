import type { StreamCursor } from '@sentinel/domain';
import { createFeature, createReducer } from '@ngrx/store';
import type { AccountDelta } from '../../workers/transaction-worker-protocol';

/** Updated once per 250 ms worker batch, never once per transaction. */
export interface TransactionsState {
  readonly accountDeltas: Readonly<Record<string, AccountDelta>>;
  readonly lastCursor: StreamCursor | null;
}

const initialTransactionsState: TransactionsState = { accountDeltas: {}, lastCursor: null };

export const transactionsFeature = createFeature({
  name: 'transactions',
  reducer: createReducer(initialTransactionsState),
});
