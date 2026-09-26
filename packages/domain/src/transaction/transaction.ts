import type { MinorUnits } from '../money/minor-units.js';
import type { InstitutionId } from '../tenant/tenant-identifiers.js';
import type { IsoTimestamp } from '../time/iso-timestamp.js';

export type TransactionChannel = 'APP' | 'IBANKING';

export type TransactionType = 'TRANSFER' | 'GIRO' | 'STANDING' | 'BILL';

/** Identifier fields carry the tokens from TransactionEvent; the platform never sees raw account numbers. */
export interface Transaction {
  readonly id: string;
  readonly ts: IsoTimestamp;
  readonly sourceAccountId: string;
  readonly destAccountId: string;
  readonly payeeId: string;
  readonly deviceId: string;
  readonly amount: MinorUnits;
  readonly channel: TransactionChannel;
  readonly type: TransactionType;
  readonly institutionId: InstitutionId;
  readonly destInstitutionId: InstitutionId;
}
