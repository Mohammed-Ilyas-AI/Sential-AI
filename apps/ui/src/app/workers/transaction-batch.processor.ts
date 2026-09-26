import type { DecisionRecord } from '@sentinel/domain';
import type { AccountRisk, TapeRow, TransactionWorkerOutput } from './transaction-worker-protocol';

const byNewest = (left: { occurredAt: string }, right: { occurredAt: string }): number => right.occurredAt.localeCompare(left.occurredAt);

function toTapeRow(decision: DecisionRecord): TapeRow {
  return {
    transactionId: decision.transactionId,
    accountId: decision.accountId,
    ...(decision.accountReference ? { accountReference: decision.accountReference } : {}),
    institutionId: decision.institutionId,
    destinationInstitutionId: decision.destinationInstitutionId,
    amount: decision.amount,
    score: decision.riskScore,
    band: decision.band,
    decision: decision.decision,
    occurredAt: decision.occurredAt,
    decidedAt: decision.decidedAt,
  };
}

/**
 * Normalise a batch of decisions into tape rows (newest first) and the accounts that changed. Pure: the
 * worker runs it off the main thread, and the same function runs in-thread where workers are unavailable.
 */
export function processTransactionBatch(batch: readonly DecisionRecord[]): TransactionWorkerOutput {
  const latestByAccount = new Map<string, DecisionRecord>();
  for (const decision of batch) {
    const current = latestByAccount.get(decision.accountId);
    if (!current || decision.occurredAt >= current.occurredAt) latestByAccount.set(decision.accountId, decision);
  }
  const accounts: AccountRisk[] = [...latestByAccount.values()].map((latest) => ({ accountId: latest.accountId, latest }));
  return { kind: 'BATCH_PROCESSED', rows: batch.map(toTapeRow).sort(byNewest), accounts };
}
