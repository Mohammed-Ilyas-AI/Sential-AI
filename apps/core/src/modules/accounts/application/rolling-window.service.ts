import type { Account, IsoTimestamp, MinorUnits, RollingWindow } from '@sentinel/domain';
import { addHours } from '@sentinel/rules';
import type { PolicyConfiguration } from '../../policy/application/ports/policy-configuration.port.js';
import type { ComputeRollingWindow } from './compute-rolling-window.use-case.js';
import type { OutflowWindowSource } from './ports/outflow-window-source.port.js';

/** The 24-hour window ending at the transaction, from the projection's effectiveAmount only. */
export class RollingWindowService implements ComputeRollingWindow {
  constructor(
    private readonly outflows: OutflowWindowSource,
    private readonly policy: PolicyConfiguration,
  ) {}

  async windowFor(account: Account, evaluatedAt: IsoTimestamp, excludingTransactionId?: string): Promise<RollingWindow> {
    const windowStart = addHours(evaluatedAt, -this.policy.rapidDrainPolicy().windowHours);
    const [outflow24h, balance24hAgo] = await Promise.all([
      this.outflows.effectiveOutflow({
        accountId: account.id,
        afterExclusive: windowStart,
        upToInclusive: evaluatedAt,
        eligibleForDrainOnly: true,
        ...(excludingTransactionId ? { excludingTransactionId } : {}),
      }),
      this.balanceAt(account, windowStart, excludingTransactionId),
    ]);
    return { accountId: account.id, windowStart, balance24hAgo, outflow24h };
  }

  /** The reported balance moved to window start by every outflow in between; inflows are not modelled. */
  private async balanceAt(account: Account, at: IsoTimestamp, excludingTransactionId?: string): Promise<MinorUnits> {
    const reportedFirst = Date.parse(account.balanceAsOf) < Date.parse(at);
    if (account.balanceAsOf === at) return account.balance;
    const moved = await this.outflows.effectiveOutflow({
      accountId: account.id,
      afterExclusive: reportedFirst ? account.balanceAsOf : at,
      upToInclusive: reportedFirst ? at : account.balanceAsOf,
      eligibleForDrainOnly: false,
      ...(excludingTransactionId ? { excludingTransactionId } : {}),
    });
    return reportedFirst ? account.balance - moved : account.balance + moved;
  }
}
