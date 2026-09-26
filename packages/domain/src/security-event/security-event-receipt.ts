import type { AccountPosture } from '../risk/account-posture.js';

/** Response of POST /v1/events/security. A retried idempotencyKey reports DUPLICATE and changes nothing. */
export interface SecurityEventReceipt {
  readonly eventId: string;
  readonly outcome: 'RECORDED' | 'DUPLICATE';
  readonly posture: AccountPosture;
}
