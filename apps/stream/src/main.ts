import { ChangeFeedPump } from './change-stream/change-feed-pump.js';
import { MongoChangeFeed } from './change-stream/mongo-change-feed.js';
import { connectStreamDatabase } from './change-stream/stream-database.js';
import { loadStreamRuntimeConfig } from './config/stream-config.js';
import { InProcessConnectionRegistry } from './connections/in-process-connection-registry.js';
import { StreamCursorTracker } from './resume/stream-cursor.js';
import { createStreamServer } from './server.js';
import { MongoStreamSnapshotSource } from './snapshot/mongo-stream-snapshot.source.js';
import { createLogger } from './telemetry/logger.js';

const config = loadStreamRuntimeConfig(process.env);
const logger = createLogger(config.logLevel);
const mongo = await connectStreamDatabase(config.mongo.uri, config.mongo.database);

const registry = new InProcessConnectionRegistry();
const cursors = new StreamCursorTracker();
const pump = new ChangeFeedPump(new MongoChangeFeed(mongo.database, cursors), registry, logger);
const server = createStreamServer({
  registry,
  snapshots: new MongoStreamSnapshotSource(mongo.database),
  cursors,
  allowedOrigins: config.allowedOrigins,
  heartbeat: { intervalMs: config.heartbeatIntervalMs },
  logger,
});

pump.start();
server.listen(config.port, () => logger.info({ port: config.port, database: config.mongo.database }, 'sentinel-stream listening'));

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    logger.info({ signal }, 'shutting down');
    void pump.stop().finally(() => server.close(() => void mongo.close().finally(() => process.exit(0))));
  });
}
