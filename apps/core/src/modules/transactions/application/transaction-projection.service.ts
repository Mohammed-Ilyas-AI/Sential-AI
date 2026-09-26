import type { TransactionEvent, TransactionLifecycleStatus, TransactionProjection } from '@sentinel/domain';
import type {
  ApplyTransactionLifecycleEvent,
  LifecycleOutcome,
  LifecycleProjectionOptions,
} from './apply-transaction-lifecycle-event.use-case.js';
import type { TransactionEventLog } from './ports/transaction-event-log.port.js';
import type { TransactionProjectionRepository } from './ports/transaction-projection-repository.port.js';
import { transactionFromEvent } from './transaction-from-event.js';

const COUNTED_STATUSES: ReadonlySet<TransactionLifecycleStatus> = new Set(['PENDING', 'AUTHORISED', 'SETTLED']);

/** Used by the decision path for the initial PENDING state and by the Pub/Sub consumer for later steps. */
export class TransactionProjectionService implements ApplyTransactionLifecycleEvent {
  constructor(
    private readonly events: TransactionEventLog,
    private readonly projections: TransactionProjectionRepository,
  ) {}

  async apply(event: TransactionEvent, options: LifecycleProjectionOptions = {}): Promise<LifecycleOutcome> {
    const logged = await this.events.append(event);
    if (logged.outcome === 'DUPLICATE') return 'DUPLICATE';

    const current = await this.projections.findByTransactionId(event.transactionId);
    if (current && event.accountSequence <= current.accountSequence) return 'HISTORY_ONLY';

    await this.projections.upsert(project(current, event, options));
    return 'PROJECTED';
  }
}

function project(
  current: TransactionProjection | null,
  event: TransactionEvent,
  options: LifecycleProjectionOptions,
): TransactionProjection {
  return {
    ...transactionFromEvent(event),
    ts: current?.ts ?? event.occurredAt,
    status: event.status,
    effectiveAmount: COUNTED_STATUSES.has(event.status) ? event.amount : 0,
    accountSequence: event.accountSequence,
    drainExcluded: current?.drainExcluded ?? options.drainExcluded ?? false,
  };
}
