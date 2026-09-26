import { MAX_RISK_SCORE, type Account, type Contribution, type RiskAssessment, type Transaction, type WindowContext } from '@sentinel/domain';
import { bandFor } from './band-for.js';
import type { RiskRule } from './risk-rule.js';

export type AssessRisk = (
  transaction: Transaction,
  account: Account,
  window: WindowContext,
  rules: readonly RiskRule[],
) => RiskAssessment;

/**
 * Runs every rule, keeps contributions above zero, sorts them by points and sums them into the score (T§3).
 * The same inputs always give the same assessment. The score is advisory; the drain gate decides.
 */
export const assess: AssessRisk = (transaction, account, window, rules) => {
  const contributions = rules
    .map((rule) => rule.evaluate(transaction, account, window))
    .filter((contribution): contribution is Contribution => contribution !== null && contribution.points > 0)
    .sort((left, right) => right.points - left.points);
  const score = Math.min(
    MAX_RISK_SCORE,
    contributions.reduce((sum, contribution) => sum + contribution.points, 0),
  );
  return {
    transactionId: transaction.id,
    score,
    band: bandFor(score),
    contributions,
    drain: window.drain,
    evaluatedAt: window.features.evaluatedAt,
  };
};
