import type { AccountSecurityEvent } from '@sentinel/domain';

/** Updates known devices, known payees and cooling-off state, deterministically and before the next decision. */
export interface RecordAccountSecurityEvent {
  record(event: AccountSecurityEvent): Promise<void>;
}
