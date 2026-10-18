import type { AuditEvent, InterventionActor, InstitutionId } from '@sentinel/domain';
import type { IdGenerator } from '../../../platform/ids/id-generator.js';
import type { Clock } from '../../../platform/time/clock.js';
import type { AuditLog, AuditLogQuery } from './ports/audit-log.port.js';

/** Who is acting, under which trace and lens. Built at the HTTP edge, passed to every audited use case. */
export interface ActingContext {
  readonly traceId: string;
  readonly actor: InterventionActor;
  readonly actorIdentity?: string;
  readonly lens: InstitutionId | null;
}

export type AuditEntry = Pick<AuditEvent, 'category' | 'action' | 'outcome' | 'subject'> & { readonly detail?: string };

/**
 * Stamps and appends audit events. Identifiers only: callers never pass a masked value, a credential or a
 * report body. Append-only, like the intervention log.
 */
export class AuditTrail {
  constructor(
    private readonly log: AuditLog,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async record(context: ActingContext, entry: AuditEntry): Promise<AuditEvent> {
    const event: AuditEvent = {
      id: this.ids.next(),
      category: entry.category,
      action: entry.action,
      outcome: entry.outcome,
      actor: context.actor,
      ...(context.actorIdentity ? { actorIdentity: context.actorIdentity } : {}),
      ...(context.lens ? { lens: context.lens } : {}),
      occurredAt: this.clock.now().toISOString(),
      traceId: context.traceId,
      subject: entry.subject,
      ...(entry.detail ? { detail: entry.detail } : {}),
    };
    await this.log.append(event);
    return event;
  }

  list(query: AuditLogQuery): Promise<readonly AuditEvent[]> {
    return this.log.list(query);
  }
}
