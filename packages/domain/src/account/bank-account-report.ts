import type { MinorUnits } from '../money/minor-units.js';
import type { InstitutionId, TenantId } from '../tenant/tenant-identifiers.js';
import type { IsoTimestamp } from '../time/iso-timestamp.js';
import type { AccountBehaviour } from './account-behaviour.js';

/**
 * Body of PUT /v1/accounts/{accountToken}: the bank connector's report of an account's balance, established
 * devices and payees, and behavioural baselines. Idempotent upsert.
 */
export interface BankAccountReport {
  readonly schemaVersion: '1.0';
  readonly tenantId: TenantId;
  readonly accountToken: string;
  readonly institutionId: InstitutionId;
  readonly displayReference: string;
  readonly openedAt: IsoTimestamp;
  readonly balance: MinorUnits;
  readonly balanceAsOf: IsoTimestamp;
  readonly knownDeviceTokens: readonly string[];
  readonly knownPayeeTokens: readonly string[];
  readonly behaviour: AccountBehaviour;
}
