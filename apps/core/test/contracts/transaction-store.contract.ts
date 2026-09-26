import type { TransactionEvent, TransactionProjection } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import type { OutflowWindowSource } from '../../src/modules/accounts/application/ports/outflow-window-source.port.js';
import type { TransactionEventLog } from '../../src/modules/transactions/application/ports/transaction-event-log.port.js';
import type { TransactionProjectionRepository } from '../../src/modules/transactions/application/ports/transaction-projection-repository.port.js';

export interface TransactionStorePorts {
  readonly events: TransactionEventLog;
  readonly projections: TransactionProjectionRepository;
  readonly outflows: OutflowWindowSource;
}

const event = (overrides: Partial<TransactionEvent> = {}): TransactionEvent => ({
  schemaVersion: '1.0',
  tenantId: 'BANK_A',
  eventId: 'EVT-contract-0001',
  idempotencyKey: 'idem-contract-0001',
  accountSequence: 1,
  transactionId: 'TX-contract-0001',
  status: 'PENDING',
  sourceAccountToken: 'acct_tok_contract1',
  destinationInstitutionId: 'BANK_B',
  destinationAccountToken: 'acct_tok_contract2',
  amount: 100_000,
  currency: 'SGD',
  channel: 'APP',
  type: 'TRANSFER',
  occurredAt: '2026-09-24T10:00:00.000Z',
  ...overrides,
});

const projection = (id: string, ts: string, effectiveAmount: number, drainExcluded = false): TransactionProjection => ({
  id,
  ts,
  sourceAccountId: 'acct_tok_contract1',
  destAccountId: 'acct_tok_contract2',
  payeeId: 'ben_tok_contract2',
  deviceId: '',
  amount: effectiveAmount || 100_000,
  channel: 'APP',
  type: drainExcluded ? 'GIRO' : 'TRANSFER',
  institutionId: 'BANK_A',
  destInstitutionId: 'BANK_B',
  status: effectiveAmount === 0 ? 'CANCELLED' : 'SETTLED',
  effectiveAmount,
  accountSequence: 1,
  drainExcluded,
});

/** The event log is immutable and idempotent; the projection is one document per payment; the window sums it. */
export function describeTransactionStoreContract(
  adapterName: string,
  createStore: () => TransactionStorePorts | Promise<TransactionStorePorts>,
): void {
  describe(`Transaction store contract: ${adapterName}`, () => {
    it('appends an event once and answers a retried idempotencyKey with the original', async () => {
      const { events } = await createStore();
      expect(await events.append(event())).toEqual({ outcome: 'CREATED', record: event() });
      const retry = event({ eventId: 'EVT-contract-retry', amount: 999 });
      expect(await events.append(retry)).toEqual({ outcome: 'DUPLICATE', record: event() });
    });

    it('keeps one projection per transaction and replaces it on upsert', async () => {
      const { projections } = await createStore();
      await projections.upsert(projection('TX-1', '2026-09-24T10:00:00.000Z', 100_000));
      await projections.upsert({ ...projection('TX-1', '2026-09-24T10:00:00.000Z', 0), status: 'REVERSED' });
      expect(await projections.findByTransactionId('TX-1')).toMatchObject({ status: 'REVERSED', effectiveAmount: 0 });
      expect(await projections.findByTransactionId('TX-missing')).toBeNull();
    });

    it('sums effectiveAmount inside (after, upTo], excluding drain-excluded payments and the evaluated transaction', async () => {
      const { projections, outflows } = await createStore();
      await projections.upsert(projection('TX-before', '2026-09-23T09:59:59.000Z', 111));
      await projections.upsert(projection('TX-at-start', '2026-09-23T10:00:00.000Z', 222));
      await projections.upsert(projection('TX-in', '2026-09-24T09:00:00.000Z', 1_000));
      await projections.upsert(projection('TX-giro', '2026-09-24T09:30:00.000Z', 5_000, true));
      await projections.upsert(projection('TX-cancelled', '2026-09-24T09:40:00.000Z', 0));
      await projections.upsert(projection('TX-self', '2026-09-24T10:00:00.000Z', 7_000));
      await projections.upsert(projection('TX-after', '2026-09-24T10:00:01.000Z', 333));

      const query = {
        accountId: 'acct_tok_contract1',
        afterExclusive: '2026-09-23T10:00:00.000Z',
        upToInclusive: '2026-09-24T10:00:00.000Z',
      };
      expect(await outflows.effectiveOutflow({ ...query, eligibleForDrainOnly: true, excludingTransactionId: 'TX-self' })).toBe(1_000);
      expect(await outflows.effectiveOutflow({ ...query, eligibleForDrainOnly: false })).toBe(13_000);
      expect(await outflows.effectiveOutflow({ ...query, accountId: 'acct_tok_other', eligibleForDrainOnly: false })).toBe(0);
    });
  });
}
