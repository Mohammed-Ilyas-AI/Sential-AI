import type { RollingWindow } from '@sentinel/domain';

export interface ComputeRollingWindow {
  windowFor(accountId: string, at: Date): Promise<RollingWindow>;
}
