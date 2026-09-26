import type { Account, AccountState } from '@sentinel/domain';

/** `accounts`: hot state, cached drain window, known devices and payees. */
export interface AccountStateRepository {
  findAccount(accountId: string): Promise<Account | null>;
  findSecurityState(accountId: string): Promise<AccountState | null>;
  saveSecurityState(state: AccountState): Promise<void>;
}
