import type { CustomerContactRecord, KillSwitchRecord } from '@sentinel/domain';
import type { IdempotentWriteResult } from '../../../../platform/idempotency/idempotent-write.js';

/**
 * `account_controls` and `customer_contacts` are append-only: no update or delete. Kill-switch history comes back
 * in the order it was appended; an append that loses a race for the same position is refused, never merged.
 */
export interface AccountControlRepository {
  /** Appends at `expectedLength`; a concurrent append at the same position fails with a CONFLICT. */
  appendKillSwitch(record: KillSwitchRecord, expectedLength: number): Promise<IdempotentWriteResult<KillSwitchRecord>>;
  killSwitchHistory(accountId: string): Promise<readonly KillSwitchRecord[]>;
  appendContact(record: CustomerContactRecord): Promise<IdempotentWriteResult<CustomerContactRecord>>;
  contacts(accountId: string): Promise<readonly CustomerContactRecord[]>;
}
