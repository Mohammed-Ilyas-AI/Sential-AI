import type { RecordedRiskAssessment } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { Collection } from 'mongodb';
import type { AssessmentRepository } from '../../../../modules/risk/application/ports/assessment-repository.port.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import { assessmentsCollection, type AssessmentDocument } from '../collections/assessments.collection.js';

const STEP = 'scheduled for build order step 6';

export class MongoAssessmentRepository implements AssessmentRepository {
  private readonly assessments: Collection<AssessmentDocument>;

  constructor(database: MongoDatabase) {
    this.assessments = database.collection<AssessmentDocument>(assessmentsCollection.name);
  }

  insert(): Promise<void> {
    throw new NotYetImplementedError('MongoAssessmentRepository.insert', STEP);
  }

  findById(): Promise<RecordedRiskAssessment | null> {
    throw new NotYetImplementedError('MongoAssessmentRepository.findById', STEP);
  }
}
