import { describe, expect, it } from 'vitest';
import type { InterventionRepository } from '../../src/modules/interventions/application/ports/intervention-repository.port.js';
import { interventionFixture } from '../support/fixtures/intervention.fixture.js';

/** Append-only behaviour every InterventionRepository adapter must preserve. */
export function describeInterventionRepositoryContract(
  adapterName: string,
  createRepository: () => InterventionRepository | Promise<InterventionRepository>,
): void {
  describe(`InterventionRepository contract: ${adapterName}`, () => {
    it('keeps the original hold when a release is appended', async () => {
      const repository = await createRepository();
      const hold = interventionFixture();
      const release = interventionFixture({
        id: 'int-fixture-0002',
        previousState: 'HELD',
        state: 'RELEASED',
        actor: 'CUSTOMER',
        actedAt: '2026-09-24T00:10:00.000Z',
      });
      await repository.append(hold);
      await repository.append(release);
      expect(await repository.findByTransactionId(hold.transactionId)).toEqual([hold, release]);
    });

    it('finds every record for an account', async () => {
      const repository = await createRepository();
      await repository.append(interventionFixture());
      await repository.append(interventionFixture({ id: 'int-fixture-0003', transactionId: 'txn-fixture-0002' }));
      expect(await repository.findByAccountId('tok-acc-fixture-0001')).toHaveLength(2);
    });
  });
}
