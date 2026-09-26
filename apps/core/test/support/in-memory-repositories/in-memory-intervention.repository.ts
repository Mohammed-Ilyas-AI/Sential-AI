import type { Intervention } from '@sentinel/domain';
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
}
