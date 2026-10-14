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
    const { gemini } = loadCoreRuntimeConfig(minimalEnvironment);
    expect(gemini.fastModel).toBeUndefined();
    expect(gemini.deepModel).toBeUndefined();
  });

  it('uses Vertex AI unless a Gemini API key is present or the Gemini API is requested', () => {
    expect(loadCoreRuntimeConfig(minimalEnvironment).gemini).toMatchObject({ provider: 'vertex-ai' });
    expect(loadCoreRuntimeConfig(minimalEnvironment).gemini.apiKey).toBeUndefined();
    expect(loadCoreRuntimeConfig({ ...minimalEnvironment, GEMINI_API_KEY: 'test-key' }).gemini).toMatchObject({ provider: 'gemini-api', apiKey: 'test-key' });
    expect(loadCoreRuntimeConfig({ ...minimalEnvironment, GEMINI_PROVIDER: 'vertex-ai', GEMINI_API_KEY: 'test-key' }).gemini.apiKey).toBeUndefined();
    // A missing key is the advisory's problem (MODEL_NOT_CONFIGURED), never a reason to stop the control path.
    expect(loadCoreRuntimeConfig({ ...minimalEnvironment, GEMINI_PROVIDER: 'gemini-api' }).gemini).toMatchObject({ provider: 'gemini-api' });
    expect(problemsOf({ ...minimalEnvironment, GEMINI_PROVIDER: 'openai' })).toEqual(['GEMINI_PROVIDER must be vertex-ai or gemini-api, got "openai"']);
  });

  it('requires an audience and service account for OIDC push verification', () => {
    expect(problemsOf({ ...minimalEnvironment, PUBSUB_PUSH_VERIFICATION: 'google-oidc' })).toEqual([
      'PUBSUB_PUSH_AUDIENCE is required when PUBSUB_PUSH_VERIFICATION=google-oidc',
      'PUBSUB_PUSH_SERVICE_ACCOUNT is required when PUBSUB_PUSH_VERIFICATION=google-oidc',
    ]);
  });
});
