import type { RiskExplanation } from '@sentinel/domain';
import type { Collection } from 'mongodb';
import type { ExplanationCache } from '../../../../modules/intelligence/application/ports/explanation-cache.port.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import { assessmentsCollection, type AssessmentDocument } from '../collections/assessments.collection.js';

/** Writes only the `explanation` field of an assessment, once; contributions[] are never touched. */
export class MongoExplanationCache implements ExplanationCache {
  private readonly assessments: Collection<AssessmentDocument>;

  constructor(database: MongoDatabase) {
    this.assessments = database.collection<AssessmentDocument>(assessmentsCollection.name);
  }

  async find(assessmentId: string): Promise<RiskExplanation | null> {
    const document = await this.assessments.findOne({ _id: assessmentId }, { projection: { explanation: 1 } });
    return document?.explanation ?? null;
  }

  async store(explanation: RiskExplanation): Promise<void> {
    await this.assessments.updateOne({ _id: explanation.assessmentId, explanation: { $exists: false } }, { $set: { explanation } });
  }
}
