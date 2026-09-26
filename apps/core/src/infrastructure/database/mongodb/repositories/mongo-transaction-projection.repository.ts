import type { TransactionProjection } from '@sentinel/domain';
import type { Collection } from 'mongodb';
import type { TransactionProjectionRepository } from '../../../../modules/transactions/application/ports/transaction-projection-repository.port.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import { transactionsCollection, type TransactionProjectionDocument } from '../collections/transactions.collection.js';
import { withoutStorageFields } from '../serializers/document-identity.js';

export class MongoTransactionProjectionRepository implements TransactionProjectionRepository {
  private readonly transactions: Collection<TransactionProjectionDocument>;

  constructor(database: MongoDatabase) {
    this.transactions = database.collection<TransactionProjectionDocument>(transactionsCollection.name);
  }

  async findByTransactionId(transactionId: string): Promise<TransactionProjection | null> {
    const document = await this.transactions.findOne({ _id: transactionId });
    return document ? withoutStorageFields(document) : null;
  }

  async upsert(projection: TransactionProjection): Promise<void> {
    await this.transactions.replaceOne({ _id: projection.id }, projection, { upsert: true });
  }
}
