import type { TransactionEvent } from '../transaction/transaction-event.js';

/** Body of POST /v1/decision/transactions: the PENDING lifecycle event, sent before the transfer commits. */
export type DecisionRequest = TransactionEvent & { readonly status: 'PENDING' };
