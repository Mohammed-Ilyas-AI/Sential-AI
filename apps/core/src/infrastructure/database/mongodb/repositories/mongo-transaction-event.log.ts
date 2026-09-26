import type { TransactionEvent } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { Collection } from 'mongodb';
import type { TransactionEventLog } from '../../../../modules/transactions/application/ports/transaction-event-log.port.js';
import type { IdempotentWriteResult } from '../../../../platform/idempotency/idempotent-write.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import {
  transactionEventsCollection,
  type TransactionEventDocument,
} from '../collections/transaction-events.collection.js';

export class MongoTransactionEventLog implements TransactionEventLog {
  private readonly events: Collection<TransactionEventDocument>;

  constructor(database: MongoDatabase) {
    this.events = database.collection<TransactionEventDocument>(transactionEventsCollection.name);
  }

  append(): Promise<IdempotentWriteResult<TransactionEvent>> {
    throw new NotYetImplementedError('MongoTransactionEventLog.append', 'scheduled for build order step 3');
  }
}
