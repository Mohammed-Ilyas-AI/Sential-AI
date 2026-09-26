import { describe, expect, it } from 'vitest';
import type { DecisionRepository } from '../../src/modules/decision/application/ports/decision-repository.port.js';
import { decisionRecordFixture } from '../support/fixtures/decision-record.fixture.js';

/** Every DecisionRepository adapter must pass this suite unchanged (Liskov substitution). */
export function describeDecisionRepositoryContract(
  adapterName: string,
  createRepository: () => DecisionRepository | Promise<DecisionRepository>,
): void {
  describe(`DecisionRepository contract: ${adapterName}`, () => {
    it('returns null for an unknown idempotencyKey', async () => {
      const repository = await createRepository();
      expect(await repository.findByIdempotencyKey('idem-unknown')).toBeNull();
    });

    it('returns a recorded decision by its idempotencyKey', async () => {
      const repository = await createRepository();
      const decision = decisionRecordFixture();
      expect(await repository.record(decision)).toEqual({ outcome: 'CREATED', record: decision });
      expect(await repository.findByIdempotencyKey(decision.idempotencyKey)).toEqual(decision);
    });

    it('answers a retry with the stored record, never the retried one', async () => {
      const repository = await createRepository();
      const original = decisionRecordFixture();
      await repository.record(original);
      const retry = decisionRecordFixture({ decisionId: 'dec-fixture-retry', riskScore: 12, decision: 'ALLOW' });
      expect(await repository.record(retry)).toEqual({ outcome: 'DUPLICATE', record: original });
    });
  });
}
