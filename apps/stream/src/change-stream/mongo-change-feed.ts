import type { StreamMessage } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { Db } from 'mongodb';
import type { ChangeFeed } from './change-feed.js';

/** One database-level change stream filtered to WATCHED_COLLECTIONS; the resume token is the global cursor. */
export class MongoChangeFeed implements ChangeFeed {
  constructor(private readonly database: Db) {}

  messages(): AsyncIterable<StreamMessage> {
    throw new NotYetImplementedError('MongoDB change feed', 'scheduled for build order step 4');
  }

  close(): Promise<void> {
    throw new NotYetImplementedError('MongoDB change feed', 'scheduled for build order step 4');
  }
}
