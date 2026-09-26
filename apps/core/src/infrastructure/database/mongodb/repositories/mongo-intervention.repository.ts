import type { Intervention, IsoTimestamp } from '@sentinel/domain';
import type { Collection } from 'mongodb';
import type { InterventionRepository } from '../../../../modules/interventions/application/ports/intervention-repository.port.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import { interventionsCollection, type InterventionDocument } from '../collections/interventions.collection.js';
import { withoutStorageFields } from '../serializers/document-identity.js';

/** insertOne only: there is no update path. `ordinal` orders a transaction's history exactly as it was appended. */
export class MongoInterventionRepository implements InterventionRepository {
  private readonly interventions: Collection<InterventionDocument>;

  constructor(database: MongoDatabase) {
    this.interventions = database.collection<InterventionDocument>(interventionsCollection.name);
  }

  async append(intervention: Intervention): Promise<void> {
    const ordinal = await this.interventions.countDocuments({ transactionId: intervention.transactionId });
    await this.interventions.insertOne({ ...intervention, _id: intervention.id, ordinal });
  }

  async findByTransactionId(transactionId: string): Promise<readonly Intervention[]> {
    const documents = await this.interventions.find({ transactionId }).sort({ ordinal: 1 }).toArray();
    return documents.map(withoutStorageFields);
  }

  async findByAccountId(accountId: string): Promise<readonly Intervention[]> {
    const documents = await this.interventions.find({ accountId }).sort({ actedAt: 1, ordinal: 1 }).toArray();
    return documents.map(withoutStorageFields);
  }

  async findHeldDueForRelease(now: IsoTimestamp): Promise<readonly Intervention[]> {
    const documents = await this.interventions
      .aggregate<InterventionDocument>([
        { $sort: { transactionId: 1, ordinal: 1 } },
        { $group: { _id: '$transactionId', latest: { $last: '$$ROOT' } } },
        { $replaceRoot: { newRoot: '$latest' } },
        { $match: { state: 'HELD', holdUntil: { $lte: now } } },
      ])
      .toArray();
    return documents.map(withoutStorageFields);
  }
}
