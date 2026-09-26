import type { Alert } from '@sentinel/domain';
import type { Collection } from 'mongodb';
import type { AlertRepository } from '../../../../modules/alerts/application/ports/alert-repository.port.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import { alertsCollection, type AlertDocument } from '../collections/alerts.collection.js';
import { withoutStorageFields } from '../serializers/document-identity.js';

export class MongoAlertRepository implements AlertRepository {
  private readonly alerts: Collection<AlertDocument>;

  constructor(database: MongoDatabase) {
    this.alerts = database.collection<AlertDocument>(alertsCollection.name);
  }

  async findOpenByAccountId(accountId: string): Promise<Alert | null> {
    const document = await this.alerts.findOne({ accountId, status: 'OPEN' });
    return document ? withoutStorageFields(document) : null;
  }

  async save(alert: Alert): Promise<void> {
    await this.alerts.replaceOne({ _id: alert.id }, alert, { upsert: true });
  }
}
