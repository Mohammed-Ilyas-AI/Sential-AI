import type { RiskExplanation } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { Collection } from 'mongodb';
import type { ExplanationCache } from '../../../../modules/intelligence/application/ports/explanation-cache.port.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import { assessmentsCollection, type AssessmentDocument } from '../collections/assessments.collection.js';

const STEP = 'scheduled for build order step 9';

/** Writes only the `explanation` field of an assessment; contributions[] are never touched. */
export class MongoExplanationCache implements ExplanationCache {
  private readonly assessments: Collection<AssessmentDocument>;

  constructor(database: MongoDatabase) {
    this.assessments = database.collection<AssessmentDocument>(assessmentsCollection.name);
  }

  find(): Promise<RiskExplanation | null> {
    throw new NotYetImplementedError('MongoExplanationCache.find', STEP);
  }

  store(): Promise<void> {
    throw new NotYetImplementedError('MongoExplanationCache.store', STEP);
  }
}
