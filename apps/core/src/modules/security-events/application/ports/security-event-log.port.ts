import type { AccountSecurityEvent } from '@sentinel/domain';
import type { IdempotentWriteResult } from '../../../../platform/idempotency/idempotent-write.js';

/** `security_events`: append-only, unique on idempotencyKey. */
export interface SecurityEventLog {
  append(event: AccountSecurityEvent): Promise<IdempotentWriteResult<AccountSecurityEvent>>;
}
