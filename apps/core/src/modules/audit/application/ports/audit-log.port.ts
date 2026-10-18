import type { AuditEvent, AuditEventCategory, InstitutionId } from '@sentinel/domain';

export interface AuditLogQuery {
  readonly limit: number;
  readonly category?: AuditEventCategory;
  /** Only events about this institution's subjects; omitted for the operator view. */
  readonly institutionId?: InstitutionId;
  readonly caseId?: string;
  readonly accountId?: string;
}

/** `audit_events` is append-only: this port deliberately has no update or delete. Newest first on read. */
export interface AuditLog {
  append(event: AuditEvent): Promise<void>;
  list(query: AuditLogQuery): Promise<readonly AuditEvent[]>;
}
