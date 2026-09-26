import type { AccountSnapshot } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { Db } from 'mongodb';
import type { AccountSnapshotSource } from './account-snapshot-source.js';

/** Read-only: sentinel-stream never writes to MongoDB. */
export class MongoAccountSnapshotSource implements AccountSnapshotSource {
  constructor(private readonly database: Db) {}

  currentSnapshot(): Promise<readonly AccountSnapshot[]> {
    throw new NotYetImplementedError('Account snapshot', 'scheduled for build order step 4');
  }
}
