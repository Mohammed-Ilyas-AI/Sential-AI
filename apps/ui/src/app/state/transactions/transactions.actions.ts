import type { DecisionRecord, StreamCursor } from '@sentinel/domain';
import { createActionGroup, props } from '@ngrx/store';
import type { AccountRisk, TapeRow } from '../../workers/transaction-worker-protocol';

export const TransactionsActions = createActionGroup({
  source: 'Transactions',
  events: {
    'Snapshot Loaded': props<{ readonly decisions: readonly DecisionRecord[]; readonly cursor: StreamCursor }>(),
    'Batch Processed': props<{ readonly rows: readonly TapeRow[]; readonly accounts: readonly AccountRisk[] }>(),
  },
});
