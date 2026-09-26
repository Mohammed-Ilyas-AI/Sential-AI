import { loadStreamRuntimeConfig } from './config/stream-config.js';
import { createStreamServer } from './server.js';
import { createLogger } from './telemetry/logger.js';

const config = loadStreamRuntimeConfig(process.env);
const logger = createLogger(config.logLevel);
const server = createStreamServer();

server.listen(config.port, () => logger.info({ port: config.port }, 'sentinel-stream listening'));

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    logger.info({ signal }, 'shutting down');
    server.close(() => process.exit(0));
  });
}
