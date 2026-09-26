import type { TransactionProjection } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { Collection } from 'mongodb';
import type { TransactionProjectionRepository } from '../../../../modules/transactions/application/ports/transaction-projection-repository.port.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import {
  transactionsCollection,
  type TransactionProjectionDocument,
} from '../collections/transactions.collection.js';

const STEP = 'scheduled for build order step 3';

export class MongoTransactionProjectionRepository implements TransactionProjectionRepository {
  private readonly transactions: Collection<TransactionProjectionDocument>;

  constructor(database: MongoDatabase) {
    this.transactions = database.collection<TransactionProjectionDocument>(transactionsCollection.name);
  }

  findByTransactionId(): Promise<TransactionProjection | null> {
    throw new NotYetImplementedError('MongoTransactionProjectionRepository.findByTransactionId', STEP);
  }

  upsert(): Promise<void> {
    throw new NotYetImplementedError('MongoTransactionProjectionRepository.upsert', STEP);
  }
}
