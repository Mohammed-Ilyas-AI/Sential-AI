import type { MinorUnits, TransactionEvent, TransactionProjection } from '@sentinel/domain';
import type { OutflowQuery, OutflowWindowSource } from '../../../src/modules/accounts/application/ports/outflow-window-source.port.js';
import type { TransactionEventLog } from '../../../src/modules/transactions/application/ports/transaction-event-log.port.js';
import type { TransactionProjectionRepository } from '../../../src/modules/transactions/application/ports/transaction-projection-repository.port.js';
import type { IdempotentWriteResult } from '../../../src/platform/idempotency/idempotent-write.js';

/** The event log, the projection and the window aggregation over one in-memory store, as MongoDB does. */
export class InMemoryTransactionStore implements TransactionEventLog, TransactionProjectionRepository, OutflowWindowSource {
  private readonly events = new Map<string, TransactionEvent>();
  private readonly projections = new Map<string, TransactionProjection>();

  async append(event: TransactionEvent): Promise<IdempotentWriteResult<TransactionEvent>> {
    const original = this.events.get(event.idempotencyKey);
    if (original) return { outcome: 'DUPLICATE', record: original };
    this.events.set(event.idempotencyKey, event);
    return { outcome: 'CREATED', record: event };
  }

  async findByTransactionId(transactionId: string): Promise<TransactionProjection | null> {
    return this.projections.get(transactionId) ?? null;
  }

  async upsert(projection: TransactionProjection): Promise<void> {
    this.projections.set(projection.id, projection);
  }

  allProjections(): readonly TransactionProjection[] {
    return [...this.projections.values()];
  }

  async effectiveOutflow(query: OutflowQuery): Promise<MinorUnits> {
    let total = 0;
    for (const projection of this.projections.values()) {
      if (projection.sourceAccountId !== query.accountId) continue;
      if (projection.ts <= query.afterExclusive || projection.ts > query.upToInclusive) continue;
      if (query.eligibleForDrainOnly && projection.drainExcluded) continue;
      if (projection.id === query.excludingTransactionId) continue;
      total += projection.effectiveAmount;
    }
    return total;
  }
}
