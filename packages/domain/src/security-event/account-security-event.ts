import type { TenantId } from '../tenant/tenant-identifiers.js';
import type { IsoTimestamp } from '../time/iso-timestamp.js';

export type AccountSecurityEventType =
  | 'NEW_DEVICE'
  | 'TOKEN_ACTIVATED'
  | 'PAYEE_ADDED'
  | 'PASSWORD_CHANGED'
  | 'MOBILE_NUMBER_CHANGED'
  | 'PROFILE_CHANGED';

/** Feeds known devices, known payees and cooling-off from real bank signals. Body of POST /v1/events/security. */
export interface AccountSecurityEvent {
  readonly schemaVersion: '1.0';
  readonly tenantId: TenantId;
  readonly eventId: string;
  readonly idempotencyKey: string;
  readonly accountToken: string;
  readonly eventType: AccountSecurityEventType;
  readonly deviceToken?: string;
  readonly beneficiaryToken?: string;
  readonly occurredAt: IsoTimestamp;
}
