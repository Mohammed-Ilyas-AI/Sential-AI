import type { MinorUnits } from '../money/minor-units.js';
import type { InstitutionId } from '../tenant/tenant-identifiers.js';
import type { IsoTimestamp } from '../time/iso-timestamp.js';
import type { AccountBehaviour } from './account-behaviour.js';

export interface Account {
  /** The account token; never a raw account number. */
  readonly id: string;
  readonly institutionId: InstitutionId;
  /** The balance the bank last reported, true at balanceAsOf. */
  readonly balance: MinorUnits;
  readonly balanceAsOf: IsoTimestamp;
  readonly openedAt: IsoTimestamp;
  readonly knownDeviceIds: readonly string[];
  readonly knownPayeeIds: readonly string[];
  /** Set by a high-risk account security event. */
  readonly coolingOffUntil?: IsoTimestamp;
  /** Balance at window start is at least the protected balance. */
  readonly protected: boolean;
  /** Own-tenant internal reference (synthetic, e.g. ACC-10291); other tenants never see it. */
  readonly displayReference?: string;
  readonly behaviour: AccountBehaviour;
}
