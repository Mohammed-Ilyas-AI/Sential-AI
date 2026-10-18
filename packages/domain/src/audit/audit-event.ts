import type { InterventionActor } from '../intervention/intervention.js';
import type { IsoTimestamp } from '../time/iso-timestamp.js';
import type { InstitutionId } from '../tenant/tenant-identifiers.js';

export type AuditEventCategory = 'CASE' | 'CASE_REPORT' | 'KILL_SWITCH' | 'CUSTOMER_CONTACT' | 'SCENARIO' | 'ACCESS';

export type AuditOutcome = 'SUCCEEDED' | 'DENIED';

/**
 * Append-only record of an analyst or system action outside the intervention log (which stays the audit trail of
 * holds). Identifiers only: never a masked field's value, a credential or a report body.
 */
export interface AuditEvent {
  readonly id: string;
  readonly category: AuditEventCategory;
  /** For example REPORT_SIGNED_OFF or CROSS_TENANT_DENIED. */
  readonly action: string;
  readonly outcome: AuditOutcome;
  readonly actor: InterventionActor;
  readonly actorIdentity?: string;
  readonly lens?: InstitutionId;
  readonly occurredAt: IsoTimestamp;
  readonly traceId: string;
  readonly subject: {
    readonly institutionId?: InstitutionId;
    readonly accountId?: string;
    readonly caseId?: string;
    readonly transactionId?: string;
    readonly reportId?: string;
    readonly reportVersion?: number;
    readonly runId?: string;
  };
  readonly detail?: string;
}
