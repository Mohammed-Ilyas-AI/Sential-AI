import { NotYetImplementedError } from '@sentinel/domain';
import type { ApplyTransactionLifecycleEvent } from './apply-transaction-lifecycle-event.use-case.js';
import type { TransactionEventLog } from './ports/transaction-event-log.port.js';
import type { TransactionProjectionRepository } from './ports/transaction-projection-repository.port.js';

/** Used by the decision path for the initial PENDING state and by the Pub/Sub consumer for later lifecycle steps. */
export class TransactionProjectionService implements ApplyTransactionLifecycleEvent {
  constructor(
    private readonly events: TransactionEventLog,
    private readonly projections: TransactionProjectionRepository,
  ) {}

  apply(): Promise<void> {
    throw new NotYetImplementedError('Transaction lifecycle projection', 'scheduled for build order step 3');
  }
}
