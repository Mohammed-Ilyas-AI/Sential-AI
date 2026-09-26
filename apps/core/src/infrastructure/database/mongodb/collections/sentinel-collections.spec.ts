import { describe, expect, it } from 'vitest';
import { SENTINEL_COLLECTIONS } from './sentinel-collections.js';

describe('SENTINEL_COLLECTIONS', () => {
  it('declares exactly the eleven v1.2 collections', () => {
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
      ].sort(),
    );
  });

  it('dedupes lifecycle events, security events and decisions on idempotencyKey', () => {
    const uniqueOnIdempotencyKey = SENTINEL_COLLECTIONS.filter((collection) =>
      collection.indexes.some((index) => index.unique === true && 'idempotencyKey' in index.key),
    ).map((collection) => collection.name);
    expect(uniqueOnIdempotencyKey.sort()).toEqual(['decisions', 'security_events', 'transaction_events']);
  });
});
