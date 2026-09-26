import { DEFAULT_RAPID_DRAIN_POLICY } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import { ConfigurationError, loadCoreRuntimeConfig } from './config-validation.js';

const minimalEnvironment = {
  CORS_ALLOWED_ORIGIN: 'http://localhost:4200',
  MONGODB_URI: 'mongodb://localhost:27017',
};

describe('loadCoreRuntimeConfig', () => {
  it('defaults the rapid-drain policy to the published SG-RD-1.0 values', () => {
    expect(loadCoreRuntimeConfig(minimalEnvironment).rapidDrainPolicy).toEqual(DEFAULT_RAPID_DRAIN_POLICY);
  });

  it('reports every missing required variable at once', () => {
    expect(() => loadCoreRuntimeConfig({})).toThrowError(ConfigurationError);
    try {
      loadCoreRuntimeConfig({});
    } catch (error) {
      expect((error as ConfigurationError).problems).toEqual([
        'CORS_ALLOWED_ORIGIN is required',
        'MONGODB_URI is required',
      ]);
    }
  });

  it('refuses changed thresholds that keep the published policy version', () => {
    expect(() =>
      loadCoreRuntimeConfig({ ...minimalEnvironment, RAPID_DRAIN_GATE_PERCENT: '40' }),
    ).toThrowError(/requires a new RAPID_DRAIN_POLICY_VERSION/);
  });

  it('accepts changed thresholds under a new policy version', () => {
    const config = loadCoreRuntimeConfig({
      ...minimalEnvironment,
      RAPID_DRAIN_GATE_PERCENT: '40',
      RAPID_DRAIN_POLICY_VERSION: 'SG-RD-1.1-test',
    });
    expect(config.rapidDrainPolicy.gatePercent).toBe(40);
  });

  it('never defaults a model identifier', () => {
    const { vertex } = loadCoreRuntimeConfig(minimalEnvironment);
    expect(vertex.fastModel).toBeUndefined();
    expect(vertex.deepModel).toBeUndefined();
  });
});
