import type { CurrencyCode, MinorUnits } from '../money/minor-units.js';
import type { InstitutionId, TenantId } from '../tenant/tenant-identifiers.js';
import type { IsoTimestamp } from '../time/iso-timestamp.js';
import type { TransactionChannel, TransactionType } from './transaction.js';

export type TransactionLifecycleStatus = 'PENDING' | 'AUTHORISED' | 'SETTLED' | 'REVERSED' | 'CANCELLED';

/** Canonical event: one per lifecycle step, stored immutably in transaction_events. */
export interface TransactionEvent {
  readonly schemaVersion: '1.0';
  readonly tenantId: TenantId;
  readonly eventId: string;
  /** Dedupe on retry: same key, same event. */
  readonly idempotencyKey: string;
  /** Per account; the Pub/Sub ordering key is sourceAccountToken. */
  readonly accountSequence: number;
  /** Stable across the lifecycle: PENDING to SETTLED is one payment. */
  readonly transactionId: string;
  readonly status: TransactionLifecycleStatus;
  readonly sourceAccountToken: string;
  readonly destinationInstitutionId: InstitutionId;
  readonly destinationAccountToken: string;
  /** Payment-rail reference, when the rail provides one. */
  readonly networkReference?: string;
  /** Network token, never a raw fingerprint. */
  readonly deviceToken?: string;
  readonly beneficiaryToken?: string;
  readonly amount: MinorUnits;
  readonly currency: CurrencyCode;
  readonly channel: TransactionChannel;
  readonly type: TransactionType;
  readonly occurredAt: IsoTimestamp;
}
