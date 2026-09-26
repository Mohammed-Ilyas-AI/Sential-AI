import type { IsoTimestamp, MinorUnits } from '@sentinel/domain';

export interface OutflowQuery {
  readonly accountId: string;
  readonly afterExclusive: IsoTimestamp;
  readonly upToInclusive: IsoTimestamp;
  /** True for the drain: standing instructions, GIRO and designated bill payments never count toward it. */
  readonly eligibleForDrainOnly: boolean;
  /** The transaction being evaluated never counts against itself, even on a retry. */
  readonly excludingTransactionId?: string;
}

/** Sums transactions.effectiveAmount only, so a PENDING then SETTLED payment counts once. */
export interface OutflowWindowSource {
  effectiveOutflow(query: OutflowQuery): Promise<MinorUnits>;
}
