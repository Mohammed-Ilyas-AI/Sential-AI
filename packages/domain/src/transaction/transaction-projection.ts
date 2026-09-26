import type { MinorUnits } from '../money/minor-units.js';
import type { Transaction } from './transaction.js';
import type { TransactionLifecycleStatus } from './transaction-event.js';

/** One document per transactionId in `transactions`. The drain window reads effectiveAmount only. */
export interface TransactionProjection extends Transaction {
  readonly status: TransactionLifecycleStatus;
  /** The amount, counted once, while PENDING, AUTHORISED or SETTLED; zero once REVERSED or CANCELLED. */
  readonly effectiveAmount: MinorUnits;
  /** An event with an older sequence updates history only, never this state. */
  readonly accountSequence: number;
}
