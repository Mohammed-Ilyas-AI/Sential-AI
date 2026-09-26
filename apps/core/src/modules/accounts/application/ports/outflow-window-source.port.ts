import type { MinorUnits } from '@sentinel/domain';

/** Sums transactions.effectiveAmount only, so a PENDING then SETTLED payment counts once. */
export interface OutflowWindowSource {
  balanceAt(accountId: string, at: Date): Promise<MinorUnits>;
  effectiveOutflowSince(accountId: string, since: Date): Promise<MinorUnits>;
}
