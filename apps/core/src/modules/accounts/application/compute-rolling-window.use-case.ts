import type { Account, IsoTimestamp, RollingWindow } from '@sentinel/domain';

export interface ComputeRollingWindow {
  windowFor(account: Account, evaluatedAt: IsoTimestamp, excludingTransactionId?: string): Promise<RollingWindow>;
}
