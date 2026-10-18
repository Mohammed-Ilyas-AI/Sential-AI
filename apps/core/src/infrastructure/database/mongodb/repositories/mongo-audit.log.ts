import type { AuditEvent } from '@sentinel/domain';
import type { Collection, Filter } from 'mongodb';
import type { AuditLog, AuditLogQuery } from '../../../../modules/audit/application/ports/audit-log.port.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import { auditEventsCollection, type AuditEventDocument } from '../collections/operations.collections.js';
import { withoutStorageFields } from '../serializers/document-identity.js';

/** insertOne only: there is no update or delete path. */
export class MongoAuditLog implements AuditLog {
  private readonly events: Collection<AuditEventDocument>;

  constructor(database: MongoDatabase) {
    this.events = database.collection<AuditEventDocument>(auditEventsCollection.name);
  }

  async append(event: AuditEvent): Promise<void> {
    await this.events.insertOne({ ...event, _id: event.id });
  }

  async list(query: AuditLogQuery): Promise<readonly AuditEvent[]> {
    const filter: Filter<AuditEventDocument> = {
      ...(query.category ? { category: query.category } : {}),
      ...(query.institutionId ? { 'subject.institutionId': query.institutionId } : {}),
      ...(query.caseId ? { 'subject.caseId': query.caseId } : {}),
      ...(query.accountId ? { 'subject.accountId': query.accountId } : {}),
    };
    const documents = await this.events.find(filter).sort({ occurredAt: -1, _id: -1 }).limit(query.limit).toArray();
    return documents.map(withoutStorageFields);
  }
}
