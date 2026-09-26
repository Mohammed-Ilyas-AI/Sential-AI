import type { AccountSecurityEventType } from '../security-event/account-security-event.js';
import type { IsoTimestamp } from '../time/iso-timestamp.js';

export interface DeviceEvent {
  readonly deviceId: string;
  readonly eventType: AccountSecurityEventType;
  readonly occurredAt: IsoTimestamp;
}

export interface PayeeEvent {
  readonly payeeId: string;
  readonly eventType: 'PAYEE_ADDED';
  readonly occurredAt: IsoTimestamp;
}
