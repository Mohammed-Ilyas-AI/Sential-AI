import type { AuditEvent, CustomerContactRecord, KillSwitchRecord } from '@sentinel/domain';
import type { AuditLog, AuditLogQuery } from '../../../src/modules/audit/application/ports/audit-log.port.js';
import type { AccountControlRepository } from '../../../src/modules/interventions/application/ports/account-control-repository.port.js';
import { ApplicationError } from '../../../src/platform/errors/application-error.js';
import type { IdempotentWriteResult } from '../../../src/platform/idempotency/idempotent-write.js';

/** Append-only, like the MongoDB adapter: a racing append at the same position is a CONFLICT, a retry a DUPLICATE. */
export class InMemoryAccountControlRepository implements AccountControlRepository {
  private readonly killSwitches: KillSwitchRecord[] = [];
  private readonly contactLog: CustomerContactRecord[] = [];

  async appendKillSwitch(record: KillSwitchRecord, expectedLength: number): Promise<IdempotentWriteResult<KillSwitchRecord>> {
    const original = this.killSwitches.find((stored) => stored.idempotencyKey === record.idempotencyKey);
    if (original) return { outcome: 'DUPLICATE', record: original };
    if (this.killSwitches.filter((stored) => stored.accountId === record.accountId).length !== expectedLength) {
      throw new ApplicationError('CONFLICT', `The kill switch on ${record.accountId} changed concurrently; reload and retry`);
    }
    this.killSwitches.push(record);
    return { outcome: 'CREATED', record };
  }

  async killSwitchHistory(accountId: string): Promise<readonly KillSwitchRecord[]> {
    return this.killSwitches.filter((record) => record.accountId === accountId);
  }

  async appendContact(record: CustomerContactRecord): Promise<IdempotentWriteResult<CustomerContactRecord>> {
    const original = this.contactLog.find((stored) => stored.idempotencyKey === record.idempotencyKey);
    if (original) return { outcome: 'DUPLICATE', record: original };
    this.contactLog.push(record);
    return { outcome: 'CREATED', record };
  }

  async contacts(accountId: string): Promise<readonly CustomerContactRecord[]> {
    return this.contactLog.filter((record) => record.accountId === accountId).reverse();
  }
}

export class InMemoryAuditLog implements AuditLog {
  private readonly events: AuditEvent[] = [];

  async append(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }

  async list(query: AuditLogQuery): Promise<readonly AuditEvent[]> {
    return this.events
      .filter(
        (event) =>
          (!query.category || event.category === query.category) &&
          (!query.institutionId || event.subject.institutionId === query.institutionId) &&
          (!query.caseId || event.subject.caseId === query.caseId) &&
          (!query.accountId || event.subject.accountId === query.accountId),
      )
      .reverse()
      .slice(0, query.limit);
  }

  all(): readonly AuditEvent[] {
    return [...this.events];
  }
}
