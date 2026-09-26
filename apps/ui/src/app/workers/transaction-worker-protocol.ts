import type { AccountSnapshot, DecisionRecord, DrainState, RiskBand } from '@sentinel/domain';

/** One rendered tape row; the tape renders at most TRANSACTION_TAPE_MAX_ROWS. */
export interface TapeRow {
  readonly transactionId: string;
  readonly accountId: string;
  readonly amount: number;
  readonly score: number;
  readonly band: RiskBand;
  readonly decision: DecisionRecord['decision'];
  readonly decidedAt: string;
}

/** Only what changed in a batch. Optimistic; the server value wins on the next snapshot. */
export interface AccountDelta {
  readonly accountId: string;
  readonly drain: DrainState;
  readonly transactionsPerMinute: number;
}

export type TransactionWorkerInput =
  | { readonly kind: 'BATCH'; readonly batch: readonly DecisionRecord[] }
  | { readonly kind: 'SNAPSHOT'; readonly accounts: readonly AccountSnapshot[] };

export type TransactionWorkerOutput =
  | { readonly kind: 'ACCOUNT_DELTA'; readonly deltas: readonly AccountDelta[] }
  | { readonly kind: 'TAPE'; readonly rows: readonly TapeRow[] };
