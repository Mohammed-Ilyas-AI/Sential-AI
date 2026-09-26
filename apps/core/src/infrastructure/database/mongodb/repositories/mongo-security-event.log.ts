import type { AccountSecurityEvent } from '@sentinel/domain';
import type { Collection } from 'mongodb';
import type { SecurityEventLog } from '../../../../modules/security-events/application/ports/security-event-log.port.js';
import type { IdempotentWriteResult } from '../../../../platform/idempotency/idempotent-write.js';
import { isDuplicateKeyError, type MongoDatabase } from '../client/mongo-connection.js';
import { securityEventsCollection, type SecurityEventDocument } from '../collections/security-events.collection.js';
import { withoutStorageFields } from '../serializers/document-identity.js';

export class MongoSecurityEventLog implements SecurityEventLog {
  private readonly events: Collection<SecurityEventDocument>;

  constructor(database: MongoDatabase) {
    this.events = database.collection<SecurityEventDocument>(securityEventsCollection.name);
  }

  async append(event: AccountSecurityEvent): Promise<IdempotentWriteResult<AccountSecurityEvent>> {
    try {
      await this.events.insertOne({ ...event, _id: event.eventId });
      return { outcome: 'CREATED', record: event };
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const original = await this.events.findOne({ idempotencyKey: event.idempotencyKey });
      return { outcome: 'DUPLICATE', record: original ? withoutStorageFields(original) : event };
    }
  }
}
