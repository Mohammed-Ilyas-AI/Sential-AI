import type { Intervention, IsoTimestamp, MinorUnits } from '@sentinel/domain';
import { createSelector } from '@ngrx/store';
import type { TapeRow } from '../../workers/transaction-worker-protocol';
import { alertsFeature } from '../alerts/alerts.feature';
import { interventionsFeature } from '../interventions/interventions.feature';
import { transactionsFeature } from '../transactions/transactions.feature';

export type AccountEvent =
  | { readonly kind: 'DECISION'; readonly at: string; readonly row: TapeRow }
  | { readonly kind: 'INTERVENTION'; readonly at: string; readonly intervention: Intervention };

/** What the mock customer push needs: the held amount, the customer's bank and the auto-release time. */
export interface HoldNotice {
  readonly transactionId: string;
  readonly amount: MinorUnits;
  readonly institutionId: string;
  readonly holdUntil?: IsoTimestamp;
}

/** The latest decision of the account in focus: the analyst's selection, or the top of the queue. */
export const selectFocusedDecision = createSelector(
  alertsFeature.selectFocusedAccountId,
  transactionsFeature.selectLatestByAccount,
  (accountId, latestByAccount) => (accountId ? (latestByAccount[accountId] ?? null) : null),
);

/** The focused account's decisions and intervention records, newest first. */
export const selectFocusedTimeline = createSelector(
  alertsFeature.selectFocusedAccountId,
  transactionsFeature.selectTape,
  interventionsFeature.selectAllInterventions,
  (accountId, tape, interventions): readonly AccountEvent[] => {
    if (!accountId) return [];
    const decisions: AccountEvent[] = tape
      .filter((row) => row.accountId === accountId)
      .map((row) => ({ kind: 'DECISION' as const, at: row.occurredAt, row }));
    const records: AccountEvent[] = interventions
      .filter((intervention) => intervention.accountId === accountId)
      .map((intervention) => ({ kind: 'INTERVENTION' as const, at: intervention.actedAt, intervention }));
    return [...decisions, ...records].sort((left, right) => right.at.localeCompare(left.at));
  },
);

/** The most recent hold still in force, for the customer notification panel. */
export const selectLatestActiveHold = createSelector(
  interventionsFeature.selectActiveHolds,
  (holds) => [...holds].sort((left, right) => right.actedAt.localeCompare(left.actedAt))[0] ?? null,
);

export const selectLatestHoldNotice = createSelector(
  selectLatestActiveHold,
  transactionsFeature.selectTape,
  (hold, tape): HoldNotice | null => {
    if (!hold) return null;
    const row = tape.find((candidate) => candidate.transactionId === hold.transactionId);
    if (!row) return null;
    return {
      transactionId: hold.transactionId,
      amount: row.amount,
      institutionId: row.institutionId,
      ...(hold.holdUntil ? { holdUntil: hold.holdUntil } : {}),
    };
  },
);
