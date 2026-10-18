import { SCENARIO_NOISE_MAX_RATE_PER_MINUTE } from '@sentinel/domain';
import { isScenarioRunId } from '@sentinel/scenarios';

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
  /** Set to replay a specific run exactly (idempotent); unset, every start is a new run with fresh identifiers. */
  readonly runId: string | null;
  readonly noise: { readonly enabled: boolean; readonly seed: number; readonly ratePerMinute: number };
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

  const runId = env['SIMULATOR_RUN_ID']?.trim().toUpperCase() || null;
  if (runId !== null && !isScenarioRunId(runId)) problems.push('SIMULATOR_RUN_ID must be 1-12 letters or digits');

  const noiseSwitch = env['SIMULATOR_NOISE_ENABLED']?.trim().toLowerCase() ?? 'false';
  if (noiseSwitch !== 'true' && noiseSwitch !== 'false') problems.push('SIMULATOR_NOISE_ENABLED must be true or false');
  const noiseSeed = Number(env['SIMULATOR_NOISE_SEED'] ?? '20260924');
  if (!Number.isSafeInteger(noiseSeed)) problems.push('SIMULATOR_NOISE_SEED must be a safe integer');
  const ratePerMinute = Number(env['SIMULATOR_NOISE_RATE_PER_MINUTE'] ?? '4');
  if (!Number.isInteger(ratePerMinute) || ratePerMinute < 1 || ratePerMinute > SCENARIO_NOISE_MAX_RATE_PER_MINUTE) {
    problems.push(`SIMULATOR_NOISE_RATE_PER_MINUTE must be an integer from 1 to ${SCENARIO_NOISE_MAX_RATE_PER_MINUTE}`);
  }

  if (problems.length > 0) throw new SimulatorConfigurationError(problems);
  return {
    coreBaseUrl,
    scenarioId: env['SIMULATOR_SCENARIO_ID']?.trim() || 'DEMO_TAKEOVER_01',
    transport,
    timeline: timeline === 'instant' ? 'instant' : 'realtime',
    logLevel: env['LOG_LEVEL'] ?? 'info',
    runId,
    noise: {
      enabled: noiseSwitch === 'true',
      seed: Number.isSafeInteger(noiseSeed) ? noiseSeed : 20260924,
      ratePerMinute: Number.isInteger(ratePerMinute) ? Math.max(1, Math.min(SCENARIO_NOISE_MAX_RATE_PER_MINUTE, ratePerMinute)) : 4,
    },
  };
}
