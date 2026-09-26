import type { Case } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { Collection } from 'mongodb';
import type { CaseRepository } from '../../../../modules/cases/application/ports/case-repository.port.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import { casesCollection, type CaseDocument } from '../collections/cases.collection.js';

const STEP = 'scheduled for build order step 10';

export class MongoCaseRepository implements CaseRepository {
  private readonly cases: Collection<CaseDocument>;

  constructor(database: MongoDatabase) {
    this.cases = database.collection<CaseDocument>(casesCollection.name);
  }

  open(): Promise<void> {
    throw new NotYetImplementedError('MongoCaseRepository.open', STEP);
  }

  findById(): Promise<Case | null> {
    throw new NotYetImplementedError('MongoCaseRepository.findById', STEP);
  }

  changeStatus(): Promise<void> {
    throw new NotYetImplementedError('MongoCaseRepository.changeStatus', STEP);
  }

  attachSummary(): Promise<void> {
    throw new NotYetImplementedError('MongoCaseRepository.attachSummary', STEP);
  }
}
