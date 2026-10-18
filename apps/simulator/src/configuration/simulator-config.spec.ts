import { describe, expect, it } from 'vitest';
import { SimulatorConfigurationError, loadSimulatorRuntimeConfig } from './simulator-config.js';

describe('loadSimulatorRuntimeConfig', () => {
  it('publishes through Pub/Sub by default and requires a project for it', () => {
    expect(() => loadSimulatorRuntimeConfig({ SIMULATOR_CORE_BASE_URL: 'http://core' })).toThrowError(SimulatorConfigurationError);
    const config = loadSimulatorRuntimeConfig({ SIMULATOR_CORE_BASE_URL: 'http://core', GCP_PROJECT_ID: 'sentinel-ai-prod' });
    expect(config.transport).toEqual({ kind: 'pubsub', projectId: 'sentinel-ai-prod', topic: 'sentinel-transaction-events' });
    expect(config.timeline).toBe('realtime');
  });

  it('derives the push endpoint for local direct-push delivery', () => {
    const config = loadSimulatorRuntimeConfig({
      SIMULATOR_CORE_BASE_URL: 'http://localhost:8080/',
      SIMULATOR_EVENT_TRANSPORT: 'direct-push',
      SIMULATOR_TIMELINE: 'instant',
    });
    expect(config.transport).toEqual({ kind: 'direct-push', pushEndpoint: 'http://localhost:8080/internal/pubsub/transaction-events' });
    expect(config.timeline).toBe('instant');
  });

  it('starts a new run by default and accepts an explicit run ID to replay one exactly', () => {
    const base = { SIMULATOR_CORE_BASE_URL: 'http://core', SIMULATOR_EVENT_TRANSPORT: 'direct-push' };
    expect(loadSimulatorRuntimeConfig(base).runId).toBeNull();
    expect(loadSimulatorRuntimeConfig({ ...base, SIMULATOR_RUN_ID: ' demo42 ' }).runId).toBe('DEMO42');
    expect(() => loadSimulatorRuntimeConfig({ ...base, SIMULATOR_RUN_ID: 'run 1!' })).toThrowError(SimulatorConfigurationError);
  });

  it('keeps seeded background noise disabled by default and bounds an enabled rate', () => {
    const base = { SIMULATOR_CORE_BASE_URL: 'http://core', SIMULATOR_EVENT_TRANSPORT: 'direct-push' };
    expect(loadSimulatorRuntimeConfig(base).noise).toEqual({ enabled: false, seed: 20260924, ratePerMinute: 4 });
    expect(loadSimulatorRuntimeConfig({ ...base, SIMULATOR_NOISE_ENABLED: 'true', SIMULATOR_NOISE_RATE_PER_MINUTE: '60' }).noise).toEqual({
      enabled: true,
      seed: 20260924,
      ratePerMinute: 60,
    });
    expect(() => loadSimulatorRuntimeConfig({ ...base, SIMULATOR_NOISE_RATE_PER_MINUTE: '61' })).toThrowError(SimulatorConfigurationError);
  });
});
