export interface StreamRuntimeConfig {
  readonly port: number;
  readonly logLevel: string;
  readonly mongo: { readonly uri: string; readonly database: string };
  /** Browsers may only open the stream from the deployed UI origin. */
  readonly allowedOrigin: string;
  readonly heartbeatIntervalMs: number;
}

/** Parses the environment passed in by main.ts; nothing else in sentinel-stream reads configuration. */
export function loadStreamRuntimeConfig(env: Readonly<Record<string, string | undefined>>): StreamRuntimeConfig {
  const problems: string[] = [];
  const uri = env['MONGODB_URI']?.trim() ?? '';
  const allowedOrigin = env['STREAM_ALLOWED_ORIGIN']?.trim() ?? '';
  if (!uri) problems.push('MONGODB_URI is required');
  if (!allowedOrigin) problems.push('STREAM_ALLOWED_ORIGIN is required');
  if (problems.length > 0) throw new Error(`Invalid sentinel-stream configuration:\n- ${problems.join('\n- ')}`);
  return {
    port: Number(env['PORT'] ?? env['STREAM_PORT'] ?? 8081),
    logLevel: env['LOG_LEVEL'] ?? 'info',
    mongo: { uri, database: env['MONGODB_DATABASE']?.trim() || 'sentinel_ai' },
    allowedOrigin,
    heartbeatIntervalMs: Number(env['STREAM_HEARTBEAT_INTERVAL_MS'] ?? 25_000),
  };
}
