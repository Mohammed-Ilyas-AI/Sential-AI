import { InjectionToken, type Provider } from '@angular/core';

/** Endpoints only. The browser never holds a model identifier or any credential. */
export interface RuntimeConfig {
  readonly coreApiBaseUrl: string;
  readonly streamUrl: string;
}

export const RUNTIME_CONFIG = new InjectionToken<RuntimeConfig>('RUNTIME_CONFIG');

export const LOCAL_RUNTIME_CONFIG: RuntimeConfig = {
  coreApiBaseUrl: 'http://localhost:8080',
  streamUrl: 'ws://localhost:8081',
};

export function provideRuntimeConfig(config: RuntimeConfig): Provider {
  return { provide: RUNTIME_CONFIG, useValue: config };
}
