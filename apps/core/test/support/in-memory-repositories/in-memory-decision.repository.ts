import type { DecisionRecord } from '@sentinel/domain';
import type { DecisionRepository } from '../../../src/modules/decision/application/ports/decision-repository.port.js';
import type { IdempotentWriteResult } from '../../../src/platform/idempotency/idempotent-write.js';

export class InMemoryDecisionRepository implements DecisionRepository {
  private readonly byIdempotencyKey = new Map<string, DecisionRecord>();

  async findByIdempotencyKey(idempotencyKey: string): Promise<DecisionRecord | null> {
    return this.byIdempotencyKey.get(idempotencyKey) ?? null;
  }

  async record(decision: DecisionRecord): Promise<IdempotentWriteResult<DecisionRecord>> {
    const existing = this.byIdempotencyKey.get(decision.idempotencyKey);
    if (existing) return { outcome: 'DUPLICATE', record: existing };
    this.byIdempotencyKey.set(decision.idempotencyKey, decision);
    return { outcome: 'CREATED', record: decision };
  }
}
