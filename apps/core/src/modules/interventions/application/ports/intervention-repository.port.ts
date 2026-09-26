import type { Intervention, IsoTimestamp } from '@sentinel/domain';

/**
 * `interventions` is append-only. This port deliberately has no update or delete: a release inserts a new
 * record and never mutates the hold. History comes back in the order it was appended.
 */
export interface InterventionRepository {
  append(intervention: Intervention): Promise<void>;
  findByTransactionId(transactionId: string): Promise<readonly Intervention[]>;
  findByAccountId(accountId: string): Promise<readonly Intervention[]>;
  /** The latest record of every transaction whose latest state is HELD with holdUntil at or before `now`. */
  findHeldDueForRelease(now: IsoTimestamp): Promise<readonly Intervention[]>;
}
