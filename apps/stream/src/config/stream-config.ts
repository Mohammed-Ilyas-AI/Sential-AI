export interface StreamRuntimeConfig {
  readonly port: number;
  readonly logLevel: string;
  readonly mongo: { readonly uri: string; readonly database: string };
  /** Browsers may only open the stream from the deployed UI's exact origins. */
  readonly allowedOrigins: readonly string[];
  readonly heartbeatIntervalMs: number;
}

/** Parses the environment passed in by main.ts; nothing else in sentinel-stream reads configuration. */
export function loadStreamRuntimeConfig(env: Readonly<Record<string, string | undefined>>): StreamRuntimeConfig {
  const problems: string[] = [];
  const uri = env['MONGODB_URI']?.trim() ?? '';
  // A comma-separated list of exact origins: scheme://host[:port], no path, never a wildcard.
  const allowedOrigins = (env['STREAM_ALLOWED_ORIGIN'] ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (!uri) problems.push('MONGODB_URI is required');
  if (allowedOrigins.length === 0) problems.push('STREAM_ALLOWED_ORIGIN is required');
  for (const origin of allowedOrigins) {
    if (!/^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(origin)) {
      problems.push(`STREAM_ALLOWED_ORIGIN entries must be exact origins like https://host, got "${origin}"`);
    }
  }
  if (problems.length > 0) throw new Error(`Invalid sentinel-stream configuration:\n- ${problems.join('\n- ')}`);
  return {
    // STREAM_PORT first, so one local .env can serve core (PORT) and stream; Cloud Run injects only PORT.
    port: Number(env['STREAM_PORT'] ?? env['PORT'] ?? 8081),
    logLevel: env['LOG_LEVEL'] ?? 'info',
    mongo: { uri, database: env['MONGODB_DATABASE']?.trim() || 'sentinel_ai' },
    allowedOrigins,
    heartbeatIntervalMs: Number(env['STREAM_HEARTBEAT_INTERVAL_MS'] ?? 25_000),
  };
}
