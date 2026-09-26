export interface StreamRuntimeConfig {
  readonly port: number;
  readonly logLevel: string;
  readonly mongo: { readonly uri: string; readonly database: string };
}

/** Parses the environment passed in by main.ts; nothing else in sentinel-stream reads configuration. */
export function loadStreamRuntimeConfig(env: Readonly<Record<string, string | undefined>>): StreamRuntimeConfig {
  const uri = env['MONGODB_URI']?.trim();
  if (!uri) throw new Error('Invalid sentinel-stream configuration: MONGODB_URI is required');
  return {
    port: Number(env['PORT'] ?? env['STREAM_PORT'] ?? 8081),
    logLevel: env['LOG_LEVEL'] ?? 'info',
    mongo: { uri, database: env['MONGODB_DATABASE'] ?? 'sentinel' },
  };
}
