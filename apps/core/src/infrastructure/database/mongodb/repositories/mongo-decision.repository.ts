import type { DecisionRecord } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { Collection } from 'mongodb';
import type { DecisionRepository } from '../../../../modules/decision/application/ports/decision-repository.port.js';
import type { IdempotentWriteResult } from '../../../../platform/idempotency/idempotent-write.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import { decisionsCollection, type DecisionDocument } from '../collections/decisions.collection.js';

const STEP = 'scheduled for build order step 3';

export class MongoDecisionRepository implements DecisionRepository {
  private readonly decisions: Collection<DecisionDocument>;

  constructor(database: MongoDatabase) {
    this.decisions = database.collection<DecisionDocument>(decisionsCollection.name);
  }

  findByIdempotencyKey(): Promise<DecisionRecord | null> {
    throw new NotYetImplementedError('MongoDecisionRepository.findByIdempotencyKey', STEP);
  }

  record(): Promise<IdempotentWriteResult<DecisionRecord>> {
    throw new NotYetImplementedError('MongoDecisionRepository.record', STEP);
  }
}
