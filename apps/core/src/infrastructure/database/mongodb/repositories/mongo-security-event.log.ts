import type { AccountSecurityEvent } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { Collection } from 'mongodb';
import type { SecurityEventLog } from '../../../../modules/security-events/application/ports/security-event-log.port.js';
import type { IdempotentWriteResult } from '../../../../platform/idempotency/idempotent-write.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import { securityEventsCollection, type SecurityEventDocument } from '../collections/security-events.collection.js';

export class MongoSecurityEventLog implements SecurityEventLog {
  private readonly events: Collection<SecurityEventDocument>;

  constructor(database: MongoDatabase) {
    this.events = database.collection<SecurityEventDocument>(securityEventsCollection.name);
  }

  append(): Promise<IdempotentWriteResult<AccountSecurityEvent>> {
    throw new NotYetImplementedError('MongoSecurityEventLog.append', 'scheduled for build order step 6');
  }
}
