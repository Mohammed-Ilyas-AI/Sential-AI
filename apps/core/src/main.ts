import { composeCoreHttp } from './composition/core-http.composition.js';
import { composeMongoPersistence } from './composition/mongo-persistence.composition.js';
import { loadCoreRuntimeConfig } from './config/config-validation.js';
import { readEnvironment } from './config/environment.js';
import { systemClock } from './infrastructure/clock/system-clock.js';
import { connectMongo } from './infrastructure/database/mongodb/client/mongo-connection.js';
import { ensureSentinelDatabase } from './infrastructure/database/mongodb/indexes/ensure-sentinel-database.js';
import { HoldReleaseScheduler } from './infrastructure/scheduling/hold-release.scheduler.js';
import { createLogger } from './infrastructure/telemetry/logger.js';
import { randomIdGenerator } from './platform/ids/id-generator.js';

const config = loadCoreRuntimeConfig(readEnvironment());
const logger = createLogger(config.logLevel);
if (config.pubsubPush.mode === 'disabled-for-local-development') {
  logger.warn('Pub/Sub push verification is disabled: local development only, never on Cloud Run');
}

const mongo = await connectMongo(config.mongo);
const setup = await ensureSentinelDatabase(mongo.database);
logger.info(
  { database: config.mongo.database, created: setup.createdCollections, indexes: setup.ensuredIndexes.length },
  'MongoDB collections and indexes ensured',
);

// Which Gemini endpoint and models this revision uses; whether a key is present, never the key itself.
logger.info(
  {
    geminiProvider: config.gemini.provider,
    fastModel: config.gemini.fastModel ?? null,
    deepModel: config.gemini.deepModel ?? null,
    ...(config.gemini.provider === 'gemini-api' ? { apiKeyConfigured: config.gemini.apiKey !== undefined } : {}),
  },
  'Gemini intelligence path configured',
);

const { app, controlPath } = composeCoreHttp({
  config,
  persistence: composeMongoPersistence(mongo.database),
  clock: systemClock,
  ids: randomIdGenerator,
  logger,
});

const holdRelease = new HoldReleaseScheduler(controlPath.interventions, systemClock, config.demoTimeCompression ? 1_000 : 60_000, logger);
holdRelease.start();

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, policyVersion: config.rapidDrainPolicy.policyVersion }, 'sentinel-core listening');
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    logger.info({ signal }, 'shutting down');
    holdRelease.stop();
    server.close(() => void mongo.close().finally(() => process.exit(0)));
  });
}
