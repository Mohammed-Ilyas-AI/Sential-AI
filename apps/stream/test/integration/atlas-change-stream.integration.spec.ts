import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { StreamMessage } from '@sentinel/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoChangeFeed } from '../../src/change-stream/mongo-change-feed.js';
import { connectStreamDatabase, type StreamDatabase } from '../../src/change-stream/stream-database.js';
import { StreamCursorTracker } from '../../src/resume/stream-cursor.js';
import { MongoStreamSnapshotSource } from '../../src/snapshot/mongo-stream-snapshot.source.js';

const ENV_FILE = fileURLToPath(new URL('../../../../.env', import.meta.url));
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
const URI = process.env['MONGODB_URI']?.trim() || undefined;
const DATABASE = `${process.env['MONGODB_DATABASE']?.trim() || 'sentinel_ai'}_it_stream_${Date.now().toString(36)}`;

const describeAgainstAtlas = URI ? describe : describe.skip;

describeAgainstAtlas(`Atlas change streams (throwaway database ${DATABASE})`, () => {
  let mongo: StreamDatabase;

  beforeAll(async () => {
    mongo = await connectStreamDatabase(URI ?? '', DATABASE);
    for (const name of ['decisions', 'alerts', 'interventions', 'accounts']) await mongo.database.createCollection(name);
  });

  afterAll(async () => {
    await mongo?.database.dropDatabase();
    await mongo?.close();
  });

  it('delivers inserts and updates on the watched collections, in commit order, and ignores the rest', async () => {
    const cursors = new StreamCursorTracker();
    const feed = new MongoChangeFeed(mongo.database, cursors);
    const received: StreamMessage[] = [];
    const iterator = feed.messages()[Symbol.asyncIterator]();
    const nextMessage = iterator.next();
    await new Promise((resolve) => setTimeout(resolve, 2_000));

    await mongo.database.collection('accounts').insertOne({ _id: 'ignored' } as never);
    await mongo.database.collection('decisions').insertOne({ _id: 'dec-1', decisionId: 'dec-1', decision: 'HOLD', riskScore: 95 } as never);
    await mongo.database.collection('alerts').insertOne({ _id: 'alert-1', id: 'alert-1', band: 'CRITICAL' } as never);
    await mongo.database.collection('interventions').insertOne({ _id: 'int-1', id: 'int-1', ordinal: 0, state: 'HELD' } as never);
    await mongo.database.collection('alerts').updateOne({ _id: 'alert-1' } as never, { $set: { onHold: true } });

    received.push((await nextMessage).value as StreamMessage);
    for (let index = 0; index < 3; index += 1) received.push((await iterator.next()).value as StreamMessage);
    await feed.close();

    expect(received.map((message) => message.kind)).toEqual(['DECISION', 'ALERT', 'INTERVENTION', 'ALERT']);
    expect(received[0]?.payload).toEqual({ decisionId: 'dec-1', decision: 'HOLD', riskScore: 95 });
    expect(received[2]?.payload).not.toHaveProperty('ordinal');
    expect(received[3]?.payload).toMatchObject({ id: 'alert-1', onHold: true });
    expect(new Set(received.map((message) => message.cursor)).size).toBe(4);
    expect(cursors.current()).toBe(received[3]?.cursor);
  });

  it('builds the reconnect snapshot from the same collections', async () => {
    const snapshot = await new MongoStreamSnapshotSource(mongo.database).currentSnapshot();
    expect(snapshot.decisions.map((decision) => decision.decisionId)).toEqual(['dec-1']);
    expect(snapshot.interventions).toHaveLength(1);
  });
});
