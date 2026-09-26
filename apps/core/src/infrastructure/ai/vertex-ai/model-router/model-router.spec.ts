import { describe, expect, it } from 'vitest';
import { ModelNotConfiguredError, ModelRouter } from './model-router.js';

describe('ModelRouter', () => {
  const router = new ModelRouter({ fastModel: 'configured-fast-model', deepModel: 'configured-deep-model' });

  it('routes explanation and enrichment jobs to the fast tier', () => {
    expect(router.resolve('RISK_EXPLANATION')).toBe('configured-fast-model');
    expect(router.resolve('ALERT_ENRICHMENT')).toBe('configured-fast-model');
  });

  it('routes case summary, correlation and report jobs to the deep tier', () => {
    expect(router.resolve('CASE_SUMMARY')).toBe('configured-deep-model');
    expect(router.resolve('CASE_REPORT_DRAFT')).toBe('configured-deep-model');
  });

  it('refuses to guess a model that is not configured', () => {
    expect(() => new ModelRouter({}).resolve('CASE_SUMMARY')).toThrowError(ModelNotConfiguredError);
  });
});
