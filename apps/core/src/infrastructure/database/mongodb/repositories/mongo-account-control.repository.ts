import type { CustomerContactRecord, KillSwitchRecord } from '@sentinel/domain';
import { MongoServerError, type Collection } from 'mongodb';
import type { AccountControlRepository } from '../../../../modules/interventions/application/ports/account-control-repository.port.js';
import { ApplicationError } from '../../../../platform/errors/application-error.js';
import type { IdempotentWriteResult } from '../../../../platform/idempotency/idempotent-write.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import {
  accountControlsCollection,
  customerContactsCollection,
  type AccountControlDocument,
  type CustomerContactDocument,
} from '../collections/operations.collections.js';
import { withoutStorageFields } from '../serializers/document-identity.js';

const DUPLICATE_KEY = 11000;

/**
 * insertOne only. The unique {accountId, ordinal} index turns two concurrent kill-switch transitions into one
 * success and one CONFLICT; the unique idempotencyKey index turns a retry into the stored record.
 */
export class MongoAccountControlRepository implements AccountControlRepository {
  private readonly killSwitches: Collection<AccountControlDocument>;
  private readonly contactLog: Collection<CustomerContactDocument>;

  constructor(database: MongoDatabase) {
    this.killSwitches = database.collection<AccountControlDocument>(accountControlsCollection.name);
    this.contactLog = database.collection<CustomerContactDocument>(customerContactsCollection.name);
  }

  async appendKillSwitch(record: KillSwitchRecord, expectedLength: number): Promise<IdempotentWriteResult<KillSwitchRecord>> {
    try {
      await this.killSwitches.insertOne({ ...record, _id: record.id, ordinal: expectedLength });
      return { outcome: 'CREATED', record };
    } catch (error) {
      if (!(error instanceof MongoServerError && error.code === DUPLICATE_KEY)) throw error;
      const original = await this.killSwitches.findOne({ idempotencyKey: record.idempotencyKey });
      if (original) return { outcome: 'DUPLICATE', record: withoutStorageFields(original) };
      throw new ApplicationError('CONFLICT', `The kill switch on ${record.accountId} changed concurrently; reload and retry`);
    }
  }

  async killSwitchHistory(accountId: string): Promise<readonly KillSwitchRecord[]> {
    const documents = await this.killSwitches.find({ accountId }).sort({ ordinal: 1 }).toArray();
    return documents.map(withoutStorageFields);
  }

  async appendContact(record: CustomerContactRecord): Promise<IdempotentWriteResult<CustomerContactRecord>> {
    try {
      await this.contactLog.insertOne({ ...record, _id: record.id });
      return { outcome: 'CREATED', record };
    } catch (error) {
      if (!(error instanceof MongoServerError && error.code === DUPLICATE_KEY)) throw error;
      const original = await this.contactLog.findOne({ idempotencyKey: record.idempotencyKey });
      if (!original) throw error;
      return { outcome: 'DUPLICATE', record: withoutStorageFields(original) };
    }
  }

  async contacts(accountId: string): Promise<readonly CustomerContactRecord[]> {
    const documents = await this.contactLog.find({ accountId }).sort({ recordedAt: -1, _id: -1 }).toArray();
    return documents.map(withoutStorageFields);
  }
}
