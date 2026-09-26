import type { Intervention } from '@sentinel/domain';

/**
 * `interventions` is append-only. This port deliberately has no update or delete: a release inserts a
 * new record and never mutates the hold.
 */
export interface InterventionRepository {
  append(intervention: Intervention): Promise<void>;
  findByTransactionId(transactionId: string): Promise<readonly Intervention[]>;
  findByAccountId(accountId: string): Promise<readonly Intervention[]>;
}
