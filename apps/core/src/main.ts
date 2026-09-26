import { createApp } from './app.js';
import { composeControlPath } from './composition/control-path.composition.js';
import { composeIntelligencePath } from './composition/intelligence-path.composition.js';
import { composeMongoPersistence } from './composition/mongo-persistence.composition.js';
import { loadCoreRuntimeConfig } from './config/config-validation.js';
import { readEnvironment } from './config/environment.js';
import { systemClock } from './infrastructure/clock/system-clock.js';
import { connectMongo } from './infrastructure/database/mongodb/client/mongo-connection.js';
import { createLogger } from './infrastructure/telemetry/logger.js';
import { randomIdGenerator } from './platform/ids/id-generator.js';

const config = loadCoreRuntimeConfig(readEnvironment());
const logger = createLogger(config.logLevel);
const mongo = await connectMongo(config.mongo);
const persistence = composeMongoPersistence(mongo.database);

const controlPath = composeControlPath({
  persistence,
  rapidDrainPolicy: config.rapidDrainPolicy,
  designatedBillingPayeeIds: config.designatedBillingPayeeIds,
  clock: systemClock,
  ids: randomIdGenerator,
});
const intelligencePath = composeIntelligencePath({ persistence, vertex: config.vertex, ids: randomIdGenerator });

const app = createApp({
  routes: [...controlPath.routes, ...intelligencePath.routes],
  corsAllowedOrigin: config.corsAllowedOrigin,
  logger,
});

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, policyVersion: config.rapidDrainPolicy.policyVersion }, 'sentinel-core listening');
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    logger.info({ signal }, 'shutting down');
    server.close(() => void mongo.close().finally(() => process.exit(0)));
  });
}
