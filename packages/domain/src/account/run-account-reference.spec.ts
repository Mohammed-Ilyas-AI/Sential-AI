import { describe, expect, it } from 'vitest';
import { MULTI_SCAM_BURST_01 } from '../constants/reference-scenarios.constants.js';
import { runAccountReference, scenarioRunOf } from './run-account-reference.js';

describe('runAccountReference', () => {
  it('keeps the catalogue reference without a run', () => {
    expect(runAccountReference('ACC-10291')).toBe('ACC-10291');
  });

  it('gives each run its own references, the same every time for the same run', () => {
    const first = runAccountReference('ACC-10291', 'MWQ937HB');
    expect(first).toMatch(/^ACC-\d{5}$/);
    expect(runAccountReference('ACC-10291', 'MWQ937HB')).toBe(first);
    expect(runAccountReference('ACC-10291', 'MWQ9A1ZZ')).not.toBe(first);
  });

  it('never gives two accounts of one run the same reference', () => {
    for (const runId of ['A', 'RUNA', 'MWQ937HB', 'ZZZZZZZZZZZZ']) {
      const references = MULTI_SCAM_BURST_01.cases.map((spec) => runAccountReference(spec.accountDisplayId, runId));
      expect(new Set(references).size).toBe(references.length);
    }
  });
});

describe('scenarioRunOf', () => {
  it('reads the scenario code and run ID from a scenario transaction ID', () => {
    expect(scenarioRunOf('TX-MSB1-MWQ937HB-0007')).toEqual({ code: 'MSB1', runId: 'MWQ937HB' });
    expect(scenarioRunOf('txn_demo_final')).toBeNull();
  });
});
