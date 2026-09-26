import type { TransactionEvent } from '@sentinel/domain';
import type { Collection } from 'mongodb';
import type { TransactionEventLog } from '../../../../modules/transactions/application/ports/transaction-event-log.port.js';
import type { IdempotentWriteResult } from '../../../../platform/idempotency/idempotent-write.js';
import { isDuplicateKeyError, type MongoDatabase } from '../client/mongo-connection.js';
import { transactionEventsCollection, type TransactionEventDocument } from '../collections/transaction-events.collection.js';
import { withoutStorageFields } from '../serializers/document-identity.js';

/** Immutable: insert only. A retried idempotencyKey is rejected by the unique index and answered with the original. */
export class MongoTransactionEventLog implements TransactionEventLog {
  private readonly events: Collection<TransactionEventDocument>;

  constructor(database: MongoDatabase) {
    this.events = database.collection<TransactionEventDocument>(transactionEventsCollection.name);
  }

  async append(event: TransactionEvent): Promise<IdempotentWriteResult<TransactionEvent>> {
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
