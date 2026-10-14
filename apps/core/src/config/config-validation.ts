import { DEFAULT_RAPID_DRAIN_POLICY, type RapidDrainPolicy } from '@sentinel/domain';
import type { EnvironmentVariables } from './environment.js';
import type { CoreRuntimeConfig, PubSubPushVerification } from './runtime-config.js';

export class ConfigurationError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid sentinel-core configuration:\n- ${problems.join('\n- ')}`);
    this.name = 'ConfigurationError';
  }
}

/** Fails fast at startup with every problem at once, rather than one at a time in production. */
export function loadCoreRuntimeConfig(env: EnvironmentVariables): CoreRuntimeConfig {
  const problems: string[] = [];

  const required = (name: string): string => {
    const value = env[name]?.trim();
    if (!value) problems.push(`${name} is required`);
    return value ?? '';
  };
  const optional = (name: string): string | undefined => env[name]?.trim() || undefined;
  const integer = (name: string, fallback: number): number => {
    const raw = env[name]?.trim();
    if (!raw) return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value)) problems.push(`${name} must be an integer, got "${raw}"`);
    return value;
  };

  const rapidDrainPolicy: RapidDrainPolicy = {
    policyVersion: optional('RAPID_DRAIN_POLICY_VERSION') ?? DEFAULT_RAPID_DRAIN_POLICY.policyVersion,
    protectedBalance: integer('RAPID_DRAIN_PROTECTED_BALANCE_MINOR', DEFAULT_RAPID_DRAIN_POLICY.protectedBalance),
    gatePercent: integer('RAPID_DRAIN_GATE_PERCENT', DEFAULT_RAPID_DRAIN_POLICY.gatePercent),
    windowHours: DEFAULT_RAPID_DRAIN_POLICY.windowHours,
    holdHours: integer('RAPID_DRAIN_HOLD_HOURS', DEFAULT_RAPID_DRAIN_POLICY.holdHours),
  };
  const thresholdsChanged =
    rapidDrainPolicy.protectedBalance !== DEFAULT_RAPID_DRAIN_POLICY.protectedBalance ||
    rapidDrainPolicy.gatePercent !== DEFAULT_RAPID_DRAIN_POLICY.gatePercent ||
    rapidDrainPolicy.holdHours !== DEFAULT_RAPID_DRAIN_POLICY.holdHours;
  if (thresholdsChanged && rapidDrainPolicy.policyVersion === DEFAULT_RAPID_DRAIN_POLICY.policyVersion) {
    problems.push('Changing rapid-drain thresholds requires a new RAPID_DRAIN_POLICY_VERSION');
  }

  // A comma-separated list of exact origins: scheme://host[:port], no path, never a wildcard.
  const corsAllowedOrigins = required('CORS_ALLOWED_ORIGIN')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  for (const origin of corsAllowedOrigins) {
    if (!/^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(origin)) {
      problems.push(`CORS_ALLOWED_ORIGIN entries must be exact origins like https://host, got "${origin}"`);
    }
  }

  const config: CoreRuntimeConfig = {
    port: integer('PORT', 8080),
    logLevel: optional('LOG_LEVEL') ?? 'info',
    corsAllowedOrigins,
    mongo: { uri: required('MONGODB_URI'), database: optional('MONGODB_DATABASE') ?? 'sentinel_ai' },
    vertex: {
      projectId: optional('GCP_PROJECT_ID') ?? '',
      location: optional('VERTEX_LOCATION') ?? 'asia-southeast1',
      fastModel: optional('GEMINI_FAST_MODEL'),
      deepModel: optional('GEMINI_DEEP_MODEL'),
    },
    rapidDrainPolicy,
    designatedBillingPayeeIds: new Set(
      (optional('DESIGNATED_BILLING_PAYEE_IDS') ?? '').split(',').map((id) => id.trim()).filter(Boolean),
    ),
    pubsubPush: readPushVerification(env, problems),
    demoTimeCompression: optional('DEMO_TIME_COMPRESSION_ENABLED') === 'true',
  };

  if (problems.length > 0) throw new ConfigurationError(problems);
  return config;
}

function readPushVerification(env: EnvironmentVariables, problems: string[]): PubSubPushVerification {
  const mode = env['PUBSUB_PUSH_VERIFICATION']?.trim();
  if (mode === 'disabled-for-local-development') return { mode };
  if (mode === 'google-oidc') {
    const audience = env['PUBSUB_PUSH_AUDIENCE']?.trim() ?? '';
    const serviceAccountEmail = env['PUBSUB_PUSH_SERVICE_ACCOUNT']?.trim() ?? '';
    if (!audience) problems.push('PUBSUB_PUSH_AUDIENCE is required when PUBSUB_PUSH_VERIFICATION=google-oidc');
    if (!serviceAccountEmail) {
      problems.push('PUBSUB_PUSH_SERVICE_ACCOUNT is required when PUBSUB_PUSH_VERIFICATION=google-oidc');
    }
    return { mode, audience, serviceAccountEmail };
  }
  problems.push('PUBSUB_PUSH_VERIFICATION must be google-oidc or disabled-for-local-development');
  return { mode: 'disabled-for-local-development' };
}
