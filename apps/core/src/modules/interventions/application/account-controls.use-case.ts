import type {
  CustomerContactChannel,
  CustomerContactOutcome,
  CustomerContactRecord,
  KillSwitchRecord,
  KillSwitchStatus,
} from '@sentinel/domain';
import type { ActingContext } from '../../audit/application/audit-trail.js';

export interface KillSwitchActivation {
  readonly accountId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
}

export interface CustomerContactInput {
  readonly accountId: string;
  readonly channel: CustomerContactChannel;
  readonly outcome: CustomerContactOutcome;
  readonly note?: string;
  readonly transactionId?: string;
  readonly caseId?: string;
  readonly idempotencyKey: string;
}

export interface WriteOutcome<TRecord> {
  readonly outcome: 'CREATED' | 'DUPLICATE';
  readonly record: TRecord;
}

/**
 * The analyst's exceptions around the policy (M§5.3) besides fraud confirmation: contact the customer, and the
 * account kill switch. Neither lets an analyst release a hold on judgement.
 */
export interface AccountControls {
  activateKillSwitch(context: ActingContext, activation: KillSwitchActivation): Promise<WriteOutcome<KillSwitchRecord>>;
  liftKillSwitchAfterCustomerVerification(context: ActingContext, accountId: string, idempotencyKey: string): Promise<WriteOutcome<KillSwitchRecord>>;
  killSwitchStatus(context: ActingContext, accountId: string): Promise<KillSwitchStatus>;
  recordContact(context: ActingContext, input: CustomerContactInput): Promise<WriteOutcome<CustomerContactRecord>>;
  contacts(context: ActingContext, accountId: string): Promise<readonly CustomerContactRecord[]>;
}

/** What the control path reads on every decision: the account's active kill switch, or null. */
export interface KillSwitchLookup {
  activeKillSwitch(accountId: string): Promise<KillSwitchRecord | null>;
}
