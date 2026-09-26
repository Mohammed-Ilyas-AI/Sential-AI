import type { Alert } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { Collection } from 'mongodb';
import type { AlertRepository } from '../../../../modules/alerts/application/ports/alert-repository.port.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import { alertsCollection, type AlertDocument } from '../collections/alerts.collection.js';

const STEP = 'scheduled for build order step 8';

export class MongoAlertRepository implements AlertRepository {
  private readonly alerts: Collection<AlertDocument>;

  constructor(database: MongoDatabase) {
    this.alerts = database.collection<AlertDocument>(alertsCollection.name);
  }

  raise(): Promise<void> {
    throw new NotYetImplementedError('MongoAlertRepository.raise', STEP);
  }

  findOpenByAccountId(): Promise<readonly Alert[]> {
    throw new NotYetImplementedError('MongoAlertRepository.findOpenByAccountId', STEP);
  }
}
