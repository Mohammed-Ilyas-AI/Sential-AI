import { DEFAULT_RAPID_DRAIN_POLICY } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import { ConfigurationError, loadCoreRuntimeConfig } from './config-validation.js';

const minimalEnvironment = {
  CORS_ALLOWED_ORIGIN: 'http://localhost:4200',
  MONGODB_URI: 'mongodb://localhost:27017',
  PUBSUB_PUSH_VERIFICATION: 'disabled-for-local-development',
};

const problemsOf = (environment: Record<string, string>): readonly string[] => {
  try {
    loadCoreRuntimeConfig(environment);
    return [];
  } catch (error) {
    return (error as ConfigurationError).problems;
  }
};

describe('loadCoreRuntimeConfig', () => {
  it('defaults the rapid-drain policy to the published SG-RD-1.0 values and the database to sentinel_ai', () => {
    const config = loadCoreRuntimeConfig(minimalEnvironment);
    expect(config.rapidDrainPolicy).toEqual(DEFAULT_RAPID_DRAIN_POLICY);
    expect(config.mongo.database).toBe('sentinel_ai');
  });

  it('reports every missing required variable at once', () => {
    expect(() => loadCoreRuntimeConfig({})).toThrowError(ConfigurationError);
    expect(problemsOf({})).toEqual([
      'CORS_ALLOWED_ORIGIN is required',
      'MONGODB_URI is required',
      'PUBSUB_PUSH_VERIFICATION must be google-oidc or disabled-for-local-development',
    ]);
  });

  it('accepts a list of exact UI origins and refuses wildcards and paths', () => {
    const config = loadCoreRuntimeConfig({ ...minimalEnvironment, CORS_ALLOWED_ORIGIN: 'https://a.run.app, https://sentinel.example.run' });
    expect(config.corsAllowedOrigins).toEqual(['https://a.run.app', 'https://sentinel.example.run']);
    expect(problemsOf({ ...minimalEnvironment, CORS_ALLOWED_ORIGIN: '*' })).toEqual([
      'CORS_ALLOWED_ORIGIN entries must be exact origins like https://host, got "*"',
    ]);
    expect(problemsOf({ ...minimalEnvironment, CORS_ALLOWED_ORIGIN: 'https://a.run.app/control-tower' })).toHaveLength(1);
  });

  it('refuses changed thresholds that keep the published policy version', () => {
    expect(problemsOf({ ...minimalEnvironment, RAPID_DRAIN_GATE_PERCENT: '40' })).toEqual([
      'Changing rapid-drain thresholds requires a new RAPID_DRAIN_POLICY_VERSION',
    ]);
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
    expect(vertex.fastThinkingLevel).toBeUndefined();
    expect(vertex.deepThinkingLevel).toBeUndefined();
  });

  it('reads the Gemini models, location and per-tier thinking level, and refuses an unknown level', () => {
    const { vertex } = loadCoreRuntimeConfig({
      ...minimalEnvironment,
      GCP_PROJECT_ID: 'sentinel-test',
      VERTEX_LOCATION: 'global',
      GEMINI_FAST_MODEL: 'fast-model',
      GEMINI_DEEP_MODEL: 'deep-model',
      GEMINI_FAST_THINKING_LEVEL: 'medium',
      GEMINI_DEEP_THINKING_LEVEL: 'HIGH',
    });
    expect(vertex).toEqual({
      projectId: 'sentinel-test',
      location: 'global',
      fastModel: 'fast-model',
      deepModel: 'deep-model',
      fastThinkingLevel: 'MEDIUM',
      deepThinkingLevel: 'HIGH',
    });
    expect(problemsOf({ ...minimalEnvironment, GEMINI_DEEP_THINKING_LEVEL: 'turbo' })).toEqual([
      'GEMINI_DEEP_THINKING_LEVEL must be one of MINIMAL, LOW, MEDIUM, HIGH, got "turbo"',
    ]);
  });

  it('requires an audience and service account for OIDC push verification', () => {
    expect(problemsOf({ ...minimalEnvironment, PUBSUB_PUSH_VERIFICATION: 'google-oidc' })).toEqual([
      'PUBSUB_PUSH_AUDIENCE is required when PUBSUB_PUSH_VERIFICATION=google-oidc',
      'PUBSUB_PUSH_SERVICE_ACCOUNT is required when PUBSUB_PUSH_VERIFICATION=google-oidc',
    ]);
  });
});
