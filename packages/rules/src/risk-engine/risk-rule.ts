import type { Account, Contribution, RiskRuleCode, Transaction, WindowContext } from '@sentinel/domain';

/**
 * The extension point of the risk engine. A rule is a pure function: the same transaction and account
 * state always produce the same contribution. Adding a rule means a new *.rule.ts and one registry entry.
 */
export interface RiskRule {
  readonly code: RiskRuleCode;
  readonly maxPoints: number;
  evaluate(transaction: Transaction, account: Account, window: WindowContext): Contribution | null;
}
