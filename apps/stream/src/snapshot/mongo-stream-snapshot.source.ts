import type { Alert, DecisionRecord, Intervention, StreamSnapshot } from '@sentinel/domain';
import type { Db, Document } from 'mongodb';
import type { StreamSnapshotSource } from './stream-snapshot-source.js';

const TAPE_SNAPSHOT_SIZE = 200;

function withoutStorageFields<TRecord>(document: Document): TRecord {
  const { _id, ordinal, ...record } = document;
  return record as TRecord;
}

/** Read-only: the latest decisions for the tape, every open alert, and the recent audit trail. */
export class MongoStreamSnapshotSource implements StreamSnapshotSource {
  constructor(private readonly database: Db) {}

  async currentSnapshot(): Promise<StreamSnapshot> {
    const [decisions, alerts, interventions] = await Promise.all([
      this.database.collection('decisions').find().sort({ decidedAt: -1 }).limit(TAPE_SNAPSHOT_SIZE).toArray(),
      this.database.collection('alerts').find({ status: 'OPEN' }).sort({ score: -1 }).toArray(),
      this.database.collection('interventions').find().sort({ actedAt: -1 }).limit(TAPE_SNAPSHOT_SIZE).toArray(),
    ]);
    return {
      decisions: decisions.reverse().map((document) => withoutStorageFields<DecisionRecord>(document)),
      alerts: alerts.map((document) => withoutStorageFields<Alert>(document)),
      interventions: interventions.reverse().map((document) => withoutStorageFields<Intervention>(document)),
    };
  }
}
