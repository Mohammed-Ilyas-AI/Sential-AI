import type { Intervention } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { Collection } from 'mongodb';
import type { InterventionRepository } from '../../../../modules/interventions/application/ports/intervention-repository.port.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import { interventionsCollection, type InterventionDocument } from '../collections/interventions.collection.js';

const STEP = 'scheduled for build order step 7';

/** insertOne only: there is no update path to implement. */
export class MongoInterventionRepository implements InterventionRepository {
  private readonly interventions: Collection<InterventionDocument>;

  constructor(database: MongoDatabase) {
    this.interventions = database.collection<InterventionDocument>(interventionsCollection.name);
  }

  append(): Promise<void> {
    throw new NotYetImplementedError('MongoInterventionRepository.append', STEP);
  }

  findByTransactionId(): Promise<readonly Intervention[]> {
    throw new NotYetImplementedError('MongoInterventionRepository.findByTransactionId', STEP);
  }

  findByAccountId(): Promise<readonly Intervention[]> {
    throw new NotYetImplementedError('MongoInterventionRepository.findByAccountId', STEP);
  }
}
