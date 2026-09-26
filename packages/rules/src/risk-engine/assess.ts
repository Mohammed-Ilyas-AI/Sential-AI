import type { Account, RiskAssessment, Transaction, WindowContext } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { RiskRule } from './risk-rule.js';

export type AssessRisk = (
  transaction: Transaction,
  account: Account,
  window: WindowContext,
  rules: readonly RiskRule[],
) => RiskAssessment;

/**
 * Runs every rule, keeps contributions above zero, sorts them by points and sums them into the score (T§3).
 * The score is advisory; the drain gate decides.
 */
export const assess: AssessRisk = () => {
  throw new NotYetImplementedError('Risk engine assess()', 'scheduled with the rules (build order step 6)');
};
