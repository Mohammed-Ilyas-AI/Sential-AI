import type {
  DesignatedBillingOrganisations,
  DrainState,
  MinorUnits,
  RapidDrainPolicy,
  RollingWindow,
  Transaction,
} from '@sentinel/domain';
import { drainExclusionFor } from './drain-exclusions.js';

export type DrainGate = (
  transaction: Transaction,
  window: RollingWindow,
  policy: RapidDrainPolicy,
  billingOrganisations: DesignatedBillingOrganisations,
) => DrainState;

const percentOf = (outflow: MinorUnits, balance: MinorUnits): number => (balance > 0 ? (outflow / balance) * 100 : 0);

/** Only accounts at or above the protected balance at window start are protected. */
export function isProtectedAtWindowStart(window: RollingWindow, policy: RapidDrainPolicy): boolean {
  return window.balance24hAgo >= policy.protectedBalance;
}

/**
 * The published SG-RD-50 control, a separate code path from the score (T§4). Exclusions bypass it; accounts
 * below the protected balance are not protected; otherwise the threshold is met when outflow including this
 * transaction is strictly more than the gate percentage of the balance at window start. The comparison is
 * integer arithmetic so no floating-point error can move a boundary.
 */
export const drainGate: DrainGate = (transaction, window, policy, billingOrganisations) => {
  const balanceAtWindowStart = window.balance24hAgo;
  const exclusionReason = drainExclusionFor(transaction, billingOrganisations);
  if (exclusionReason !== null) {
    return {
      balanceAtWindowStart,
      outflow24h: window.outflow24h,
      drainPct: percentOf(window.outflow24h, balanceAtWindowStart),
      thresholdMet: false,
      excluded: true,
      exclusionReason,
    };
  }

  const outflow24h = window.outflow24h + transaction.amount;
  return {
    balanceAtWindowStart,
    outflow24h,
    drainPct: percentOf(outflow24h, balanceAtWindowStart),
    thresholdMet:
      isProtectedAtWindowStart(window, policy) && outflow24h * 100 > balanceAtWindowStart * policy.gatePercent,
    excluded: false,
  };
};
