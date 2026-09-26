import type { InstitutionId } from '../tenant/tenant-identifiers.js';
import type { IsoTimestamp } from '../time/iso-timestamp.js';

/** The account as the evidence bundle presents it: synthetic identifiers only, never names or account numbers. */
export interface AccountProfile {
  readonly accountId: string;
  readonly institutionId: InstitutionId;
  readonly openedAt: IsoTimestamp;
  readonly protected: boolean;
  readonly coolingOffUntil?: IsoTimestamp;
}
