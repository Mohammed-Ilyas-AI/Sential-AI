import type { IsoTimestamp } from '../time/iso-timestamp.js';

/** Security-derived account state, written from AccountSecurityEvents (T§2 v1.2). */
export interface AccountState {
  readonly accountId: string;
  readonly newDeviceAt?: IsoTimestamp;
  readonly coolingOffUntil?: IsoTimestamp;
  readonly deviceFirstSeenAt: Readonly<Record<string, IsoTimestamp>>;
  readonly payeeFirstSeenAt: Readonly<Record<string, IsoTimestamp>>;
}
