export type LifecycleTransport =
  | { readonly kind: 'pubsub'; readonly projectId: string; readonly topic: string }
  | { readonly kind: 'direct-push'; readonly pushEndpoint: string };

export interface SimulatorRuntimeConfig {
  readonly coreBaseUrl: string;
  readonly scenarioId: string;
  readonly transport: LifecycleTransport;
  /** realtime replays the scenario on its documented clock; instant runs it as fast as the API answers. */
  readonly timeline: 'realtime' | 'instant';
  readonly logLevel: string;
}

export class SimulatorConfigurationError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid sentinel-simulator configuration:\n- ${problems.join('\n- ')}`);
    this.name = 'SimulatorConfigurationError';
  }
}

export function loadSimulatorRuntimeConfig(env: Readonly<Record<string, string | undefined>>): SimulatorRuntimeConfig {
  const problems: string[] = [];
  const coreBaseUrl = env['SIMULATOR_CORE_BASE_URL']?.trim().replace(/\/$/, '') ?? '';
  if (!coreBaseUrl) problems.push('SIMULATOR_CORE_BASE_URL is required');

  const transportKind = env['SIMULATOR_EVENT_TRANSPORT']?.trim() ?? 'pubsub';
  let transport: LifecycleTransport;
  if (transportKind === 'direct-push') {
    transport = { kind: 'direct-push', pushEndpoint: `${coreBaseUrl}/internal/pubsub/transaction-events` };
  } else if (transportKind === 'pubsub') {
    const projectId = env['GCP_PROJECT_ID']?.trim() ?? '';
    if (!projectId) problems.push('GCP_PROJECT_ID is required when SIMULATOR_EVENT_TRANSPORT=pubsub');
    transport = { kind: 'pubsub', projectId, topic: env['SIMULATOR_PUBSUB_TOPIC']?.trim() || 'sentinel-transaction-events' };
  } else {
    problems.push('SIMULATOR_EVENT_TRANSPORT must be pubsub or direct-push');
    transport = { kind: 'direct-push', pushEndpoint: '' };
  }

  const timeline = env['SIMULATOR_TIMELINE']?.trim() ?? 'realtime';
  if (timeline !== 'realtime' && timeline !== 'instant') problems.push('SIMULATOR_TIMELINE must be realtime or instant');

  if (problems.length > 0) throw new SimulatorConfigurationError(problems);
  return {
    coreBaseUrl,
    scenarioId: env['SIMULATOR_SCENARIO_ID']?.trim() || 'DEMO_TAKEOVER_01',
    transport,
    timeline: timeline === 'instant' ? 'instant' : 'realtime',
    logLevel: env['LOG_LEVEL'] ?? 'info',
  };
}
