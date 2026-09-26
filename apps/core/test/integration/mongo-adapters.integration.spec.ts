import { describe, it } from 'vitest';

describe('MongoDB adapters against a real Atlas cluster', () => {
  it.todo('pass the DecisionRepository contract (requires MONGODB_URI_INTEGRATION)');
  it.todo('pass the InterventionRepository contract (requires MONGODB_URI_INTEGRATION)');
  it.todo('create every documented index through ensureIndexes()');
  it.todo('reject a second transaction_events insert with the same idempotencyKey');
});
