import type { StreamMessage } from '@sentinel/domain';
import type { ChangeStream, ChangeStreamDocument, Db, Document } from 'mongodb';
import { normaliseChange } from '../messages/stream-message.normalizer.js';
import { WATCHED_COLLECTIONS, type ChangeFeed, type WatchedCollection } from './change-feed.js';
import type { StreamCursorTracker } from '../resume/stream-cursor.js';

const isWatched = (collection: string): collection is WatchedCollection =>
  (WATCHED_COLLECTIONS as readonly string[]).includes(collection);

/** One database-level change stream filtered to the watched collections; its resume token is the global cursor. */
export class MongoChangeFeed implements ChangeFeed {
  private stream: ChangeStream<Document, ChangeStreamDocument> | undefined;

  constructor(
    private readonly database: Db,
    private readonly cursors: StreamCursorTracker,
  ) {}

  async *messages(): AsyncIterable<StreamMessage> {
    this.stream = this.database.watch(
      [{ $match: { 'ns.coll': { $in: [...WATCHED_COLLECTIONS] }, operationType: { $in: ['insert', 'update', 'replace'] } } }],
      { fullDocument: 'updateLookup' },
    );
    for await (const change of this.stream) {
      if (!('ns' in change) || !('fullDocument' in change) || !change.fullDocument) continue;
      const collection = change.ns.coll ?? '';
      if (!isWatched(collection)) continue;
      const cursor = this.cursors.advance(change._id);
      yield normaliseChange({ collection, document: change.fullDocument, cursor }, new Date().toISOString());
    }
  }

  async close(): Promise<void> {
    await this.stream?.close();
  }
}
