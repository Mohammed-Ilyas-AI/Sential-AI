import { InjectionToken, type Provider } from '@angular/core';

/** Endpoints and demo labelling only. The browser never holds a model identifier or any credential. */
export interface RuntimeConfig {
  readonly coreApiBaseUrl: string;
  readonly streamUrl: string;
  /** True when sentinel-core runs with demo time compression; the UI then labels every hold as demo time. */
  readonly demoTimeCompression: boolean;
}

export const RUNTIME_CONFIG = new InjectionToken<RuntimeConfig>('RUNTIME_CONFIG');

export const LOCAL_RUNTIME_CONFIG: RuntimeConfig = {
  coreApiBaseUrl: 'http://localhost:8080',
  streamUrl: 'ws://localhost:8081/stream',
  demoTimeCompression: true,
};

/** Served next to index.html so one image can be pointed at any environment without a rebuild. */
export const RUNTIME_CONFIG_PATH = 'runtime-config.json';

function isRuntimeConfigOverride(value: unknown): value is Partial<RuntimeConfig> {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    ['coreApiBaseUrl', 'streamUrl'].every((key) => candidate[key] === undefined || typeof candidate[key] === 'string') &&
    (candidate['demoTimeCompression'] === undefined || typeof candidate['demoTimeCompression'] === 'boolean')
  );
}

/** Reads runtime-config.json; anything missing or malformed falls back to the local defaults. */
export async function loadRuntimeConfig(fetchConfig: typeof fetch = fetch): Promise<RuntimeConfig> {
  try {
    const response = await fetchConfig(RUNTIME_CONFIG_PATH, { cache: 'no-store' });
    if (!response.ok) return LOCAL_RUNTIME_CONFIG;
    const body: unknown = await response.json();
    return isRuntimeConfigOverride(body) ? { ...LOCAL_RUNTIME_CONFIG, ...body } : LOCAL_RUNTIME_CONFIG;
  } catch {
    return LOCAL_RUNTIME_CONFIG;
  }
}

export function provideRuntimeConfig(config: RuntimeConfig): Provider {
  return { provide: RUNTIME_CONFIG, useValue: config };
}
