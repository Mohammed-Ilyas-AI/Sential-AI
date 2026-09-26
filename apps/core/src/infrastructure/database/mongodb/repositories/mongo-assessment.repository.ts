import type { RecordedRiskAssessment } from '@sentinel/domain';
import type { Collection } from 'mongodb';
import type { AssessmentRepository } from '../../../../modules/risk/application/ports/assessment-repository.port.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import { assessmentsCollection, type AssessmentDocument } from '../collections/assessments.collection.js';
import { fromAssessmentDocument, toAssessmentDocument } from '../serializers/assessment.serializer.js';

/** Insert-only: there is no code path that modifies a stored contribution. */
export class MongoAssessmentRepository implements AssessmentRepository {
  private readonly assessments: Collection<AssessmentDocument>;

  constructor(database: MongoDatabase) {
    this.assessments = database.collection<AssessmentDocument>(assessmentsCollection.name);
  }

  async insert(assessment: RecordedRiskAssessment): Promise<void> {
    await this.assessments.insertOne(toAssessmentDocument(assessment));
  }

  async findById(assessmentId: string): Promise<RecordedRiskAssessment | null> {
    const document = await this.assessments.findOne({ _id: assessmentId });
    return document ? fromAssessmentDocument(document) : null;
  }
}
