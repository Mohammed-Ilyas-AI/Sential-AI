import type { Account, AccountState } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { Collection } from 'mongodb';
import type { AccountStateRepository } from '../../../../modules/accounts/application/ports/account-state-repository.port.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import { accountsCollection, type AccountDocument } from '../collections/accounts.collection.js';

const STEP = 'scheduled for build order step 3';

export class MongoAccountStateRepository implements AccountStateRepository {
  private readonly accounts: Collection<AccountDocument>;

  constructor(database: MongoDatabase) {
    this.accounts = database.collection<AccountDocument>(accountsCollection.name);
  }

  findAccount(): Promise<Account | null> {
    throw new NotYetImplementedError('MongoAccountStateRepository.findAccount', STEP);
  }

  findSecurityState(): Promise<AccountState | null> {
    throw new NotYetImplementedError('MongoAccountStateRepository.findSecurityState', STEP);
  }

  saveSecurityState(): Promise<void> {
    throw new NotYetImplementedError('MongoAccountStateRepository.saveSecurityState', STEP);
  }
}
