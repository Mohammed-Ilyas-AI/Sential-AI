import type { InterventionActor } from './intervention.js';
import type { IsoTimestamp } from '../time/iso-timestamp.js';

export type KillSwitchState = 'ACTIVE' | 'LIFTED';

/**
 * The analyst-initiated kill switch (M§5.3): every eligible outflow on one account is held pending customer
 * verification. Account-scoped, never platform-wide. Append-only: lifting inserts a record, it never edits one.
 * The documented drain exclusions stay outside it, exactly as they stay outside the gate and the hold cascade.
 */
export interface KillSwitchRecord {
  readonly id: string;
  readonly accountId: string;
  readonly previousState: KillSwitchState | 'NONE';
  readonly state: KillSwitchState;
  readonly reason: string;
  /** ANALYST activates; only CUSTOMER verification lifts. An analyst can never lift it on judgement. */
  readonly actor: InterventionActor;
  readonly actorIdentity?: string;
  readonly actedAt: IsoTimestamp;
  /** A retried activation with the same key returns this record and has no further effect. */
  readonly idempotencyKey: string;
}

export interface KillSwitchStatus {
  readonly accountId: string;
  readonly active: boolean;
  readonly history: readonly KillSwitchRecord[];
}

export type CustomerContactChannel = 'PHONE' | 'SECURE_MESSAGE' | 'IN_APP_PUSH';
export type CustomerContactOutcome = 'REACHED' | 'NO_ANSWER' | 'MESSAGE_LEFT' | 'NOTIFICATION_SENT';

/**
 * One recorded attempt to contact the customer. The prototype has no customer channel: every attempt goes to the
 * mock notification publisher and is marked simulated. A contact never releases a hold; only the customer's
 * verification with the bank does.
 */
export interface CustomerContactRecord {
  readonly id: string;
  readonly accountId: string;
  readonly transactionId?: string;
  readonly caseId?: string;
  readonly channel: CustomerContactChannel;
  readonly outcome: CustomerContactOutcome;
  readonly note?: string;
  readonly actor: 'ANALYST';
  readonly actorIdentity: string;
  readonly recordedAt: IsoTimestamp;
  readonly idempotencyKey: string;
  readonly simulated: true;
}
