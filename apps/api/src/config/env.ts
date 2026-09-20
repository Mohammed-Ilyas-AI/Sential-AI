/**
 * Single place environment is read. Nothing else in the API touches process.env.
 * Policy thresholds are configuration, never constants in detection code.
 */
function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number, got "${raw}"`);
  return parsed;
}

function str(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const env = {
  port: num('PORT', 8080),
  nodeEnv: str('NODE_ENV', 'development'),
  logLevel: str('LOG_LEVEL', 'info'),

  gcp: {
    projectId: str('GCP_PROJECT_ID'),
    region: str('GCP_REGION', 'asia-southeast1'),
    transactionsTopic: str('PUBSUB_TOPIC_TRANSACTIONS', 'sentinel-transactions'),
  },

  vertex: {
    location: str('VERTEX_LOCATION', 'asia-southeast1'),
    model: str('GEMINI_MODEL', 'gemini-2.5-pro'),
  },

  rapidDrain: {
    windowMinutes: num('RAPID_DRAIN_WINDOW_MINUTES', 60),
    balancePct: num('RAPID_DRAIN_BALANCE_PCT', 50),
    minAmountMinor: num('RAPID_DRAIN_MIN_AMOUNT_SGD', 1000) * 100,
  },
} as const;
