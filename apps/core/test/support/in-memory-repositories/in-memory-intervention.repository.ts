import type { Intervention, IsoTimestamp } from '@sentinel/domain';
import type { InterventionRepository } from '../../../src/modules/interventions/application/ports/intervention-repository.port.js';

export class InMemoryInterventionRepository implements InterventionRepository {
  private readonly log: Intervention[] = [];

  async append(intervention: Intervention): Promise<void> {
    this.log.push(intervention);
  }

  async findByTransactionId(transactionId: string): Promise<readonly Intervention[]> {
    return this.log.filter((intervention) => intervention.transactionId === transactionId);
  }

  async findByAccountId(accountId: string): Promise<readonly Intervention[]> {
    return this.log.filter((intervention) => intervention.accountId === accountId);
  }

  async findHeldDueForRelease(now: IsoTimestamp): Promise<readonly Intervention[]> {
    const latestByTransaction = new Map<string, Intervention>();
    for (const intervention of this.log) latestByTransaction.set(intervention.transactionId, intervention);
    return [...latestByTransaction.values()].filter(
      (latest) => latest.state === 'HELD' && latest.holdUntil !== undefined && latest.holdUntil <= now,
    );
  }
}
