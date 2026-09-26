import type { MinorUnits } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { Collection } from 'mongodb';
import type { OutflowWindowSource } from '../../../../modules/accounts/application/ports/outflow-window-source.port.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import { accountsCollection, type AccountDocument } from '../collections/accounts.collection.js';
import {
  transactionsCollection,
  type TransactionProjectionDocument,
} from '../collections/transactions.collection.js';

const STEP = 'scheduled for build order step 3';

/** $match on account and time, $group to sum effectiveAmount, $merge into the account's cached window. */
export class MongoOutflowWindowSource implements OutflowWindowSource {
  private readonly accounts: Collection<AccountDocument>;
  private readonly transactions: Collection<TransactionProjectionDocument>;

  constructor(database: MongoDatabase) {
    this.accounts = database.collection<AccountDocument>(accountsCollection.name);
    this.transactions = database.collection<TransactionProjectionDocument>(transactionsCollection.name);
  }

  balanceAt(): Promise<MinorUnits> {
    throw new NotYetImplementedError('MongoOutflowWindowSource.balanceAt', STEP);
  }

  effectiveOutflowSince(): Promise<MinorUnits> {
    throw new NotYetImplementedError('MongoOutflowWindowSource.effectiveOutflowSince', STEP);
  }
}
