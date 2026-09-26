import type { MinorUnits } from '@sentinel/domain';
import type { Collection, Filter } from 'mongodb';
import type { OutflowQuery, OutflowWindowSource } from '../../../../modules/accounts/application/ports/outflow-window-source.port.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import { transactionsCollection, type TransactionProjectionDocument } from '../collections/transactions.collection.js';

/** One aggregation over the projection: $match on account and time, $group to sum effectiveAmount. */
export class MongoOutflowWindowSource implements OutflowWindowSource {
  private readonly transactions: Collection<TransactionProjectionDocument>;

  constructor(database: MongoDatabase) {
    this.transactions = database.collection<TransactionProjectionDocument>(transactionsCollection.name);
  }

  async effectiveOutflow(query: OutflowQuery): Promise<MinorUnits> {
    const match: Filter<TransactionProjectionDocument> = {
      sourceAccountId: query.accountId,
      ts: { $gt: query.afterExclusive, $lte: query.upToInclusive },
      ...(query.eligibleForDrainOnly ? { drainExcluded: false } : {}),
      ...(query.excludingTransactionId ? { _id: { $ne: query.excludingTransactionId } } : {}),
    };
    const [totals] = await this.transactions
      .aggregate<{ readonly total: number }>([{ $match: match }, { $group: { _id: null, total: { $sum: '$effectiveAmount' } } }])
      .toArray();
    return totals?.total ?? 0;
  }
}
