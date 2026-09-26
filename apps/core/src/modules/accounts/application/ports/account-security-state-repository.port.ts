import type { AccountState } from '@sentinel/domain';

/** Security-derived state, kept apart from financial transaction state. */
export interface AccountSecurityStateRepository {
  findSecurityState(accountId: string): Promise<AccountState | null>;
  saveSecurityState(state: AccountState): Promise<void>;
}
