export interface SimulatorRuntimeConfig {
  readonly coreBaseUrl: string;
  readonly pubsubTopic: string;
  readonly scenarioId: string;
  readonly demoTimeCompression: boolean;
  readonly logLevel: string;
}

export function loadSimulatorRuntimeConfig(env: Readonly<Record<string, string | undefined>>): SimulatorRuntimeConfig {
  const coreBaseUrl = env['SIMULATOR_CORE_BASE_URL']?.trim();
  if (!coreBaseUrl) throw new Error('Invalid sentinel-simulator configuration: SIMULATOR_CORE_BASE_URL is required');
  return {
    coreBaseUrl,
    pubsubTopic: env['SIMULATOR_PUBSUB_TOPIC'] ?? 'sentinel-transaction-events',
    scenarioId: env['SIMULATOR_SCENARIO_ID'] ?? 'DEMO_TAKEOVER_01',
    demoTimeCompression: env['DEMO_TIME_COMPRESSION_ENABLED'] === 'true',
    logLevel: env['LOG_LEVEL'] ?? 'info',
  };
}
