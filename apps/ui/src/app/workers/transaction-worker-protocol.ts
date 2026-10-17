import type { DecisionRecord, InstitutionId, MinorUnits, RiskBand } from '@sentinel/domain';

/** One rendered tape row; the tape renders at most TRANSACTION_TAPE_MAX_ROWS. */
export interface TapeRow {
  readonly transactionId: string;
  readonly accountId: string;
  readonly accountReference?: string;
  readonly institutionId: InstitutionId;
  readonly destinationInstitutionId: InstitutionId;
  readonly amount: MinorUnits;
  readonly score: number;
  readonly band: RiskBand;
  readonly decision: DecisionRecord['decision'];
  readonly occurredAt: string;
  readonly decidedAt: string;
  /** For the audit log: the policy and ruleset in force, why, and the trace that joins logs and events. */
  readonly reasonCodes: readonly string[];
  readonly policyVersion: string;
  readonly rulesetVersion: string;
  readonly traceId: string;
}

/** Only accounts that changed in a batch, each with its latest decision. */
export interface AccountRisk {
  readonly accountId: string;
  readonly latest: DecisionRecord;
}

export type TransactionWorkerInput = { readonly kind: 'BATCH'; readonly batch: readonly DecisionRecord[] };

export type TransactionWorkerOutput = {
  readonly kind: 'BATCH_PROCESSED';
  readonly rows: readonly TapeRow[];
  readonly accounts: readonly AccountRisk[];
};
