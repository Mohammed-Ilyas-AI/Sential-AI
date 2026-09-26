import type { MinorUnits } from '../money/minor-units.js';
import type { InstitutionId } from '../tenant/tenant-identifiers.js';
import type { IsoTimestamp } from '../time/iso-timestamp.js';

export interface Account {
  readonly id: string;
  readonly institutionId: InstitutionId;
  readonly balance: MinorUnits;
  readonly openedAt: IsoTimestamp;
  readonly knownDeviceIds: readonly string[];
  readonly knownPayeeIds: readonly string[];
  /** Set by a high-risk account security event. */
  readonly coolingOffUntil?: IsoTimestamp;
  /** Balance at window start is at least the protected balance. */
  readonly protected: boolean;
}
