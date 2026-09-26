import type { InterventionActor, IsoTimestamp } from '@sentinel/domain';
import type { TraceId } from '../correlation/trace-id.js';

/** Who acted, when, and under which trace. Stamped on every audited write. */
export interface AuditContext {
  readonly traceId: TraceId;
  readonly actor: InterventionActor;
  /** Required whenever the actor is ANALYST. */
  readonly actorIdentity?: string;
  readonly occurredAt: IsoTimestamp;
}
