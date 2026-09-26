import { NotYetImplementedError } from '@sentinel/domain';
import { loadSimulatorRuntimeConfig } from './configuration/simulator-config.js';
import { createLogger } from './telemetry/logger.js';

const config = loadSimulatorRuntimeConfig(process.env);
const logger = createLogger(config.logLevel);

logger.info({ scenarioId: config.scenarioId }, 'sentinel-simulator starting');
throw new NotYetImplementedError('Simulator job', 'scenario runner wiring is scheduled for build order step 2');
