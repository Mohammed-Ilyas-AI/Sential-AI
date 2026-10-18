import { describe, expect, it } from 'vitest';
import { SENTINEL_COLLECTIONS } from './sentinel-collections.js';

describe('SENTINEL_COLLECTIONS', () => {
  it('declares the v1.2 collections plus the operational records added for the readiness gaps', () => {
    expect(SENTINEL_COLLECTIONS.map((collection) => collection.name).sort()).toEqual(
      [
        'accounts',
        'alerts',
        'assessments',
        'cases',
        'decisions',
        'entities',
        'entity_edges',
        'interventions',
        'security_events',
        'transaction_events',
        'transactions',
        'audit_events',
        'account_controls',
        'customer_contacts',
        'case_reports',
        'case_summaries',
        'scenario_runs',
      ].sort(),
    );
  });

  it('dedupes idempotent event and control writes on idempotencyKey', () => {
    const uniqueOnIdempotencyKey = SENTINEL_COLLECTIONS.filter((collection) =>
      collection.indexes.some((index) => index.unique === true && 'idempotencyKey' in index.key),
    ).map((collection) => collection.name);
    expect(uniqueOnIdempotencyKey.sort()).toEqual(
      ['decisions', 'security_events', 'transaction_events', 'account_controls', 'customer_contacts', 'scenario_runs'].sort(),
    );
  });

  it('archives one validated summary per assessment', () => {
    const summaries = SENTINEL_COLLECTIONS.find((collection) => collection.name === 'case_summaries');
    expect(summaries?.indexes.some((index) => index.unique === true && 'assessmentId' in index.key)).toBe(true);
  });
});
