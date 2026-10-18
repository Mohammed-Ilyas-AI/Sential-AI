import type { DecisionRecord } from '@sentinel/domain';
import type { Collection } from 'mongodb';
import type { DecisionRepository } from '../../../../modules/decision/application/ports/decision-repository.port.js';
import type { IdempotentWriteResult } from '../../../../platform/idempotency/idempotent-write.js';
import { isDuplicateKeyError, type MongoDatabase } from '../client/mongo-connection.js';
import { decisionsCollection, type DecisionDocument } from '../collections/decisions.collection.js';
import { fromDecisionDocument, toDecisionDocument } from '../serializers/decision.serializer.js';

export class MongoDecisionRepository implements DecisionRepository {
  private readonly decisions: Collection<DecisionDocument>;

  constructor(database: MongoDatabase) {
    this.decisions = database.collection<DecisionDocument>(decisionsCollection.name);
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<DecisionRecord | null> {
    const document = await this.decisions.findOne({ idempotencyKey });
    return document ? fromDecisionDocument(document) : null;
  }

  async findByTransactionId(transactionId: string): Promise<DecisionRecord | null> {
    const document = await this.decisions.findOne({ transactionId });
    return document ? fromDecisionDocument(document) : null;
  }

  async record(decision: DecisionRecord): Promise<IdempotentWriteResult<DecisionRecord>> {
    try {
      await this.decisions.insertOne(toDecisionDocument(decision));
      return { outcome: 'CREATED', record: decision };
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const original = await this.findByIdempotencyKey(decision.idempotencyKey);
      return { outcome: 'DUPLICATE', record: original ?? decision };
    }
  }
}
