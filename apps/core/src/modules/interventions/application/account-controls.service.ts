import type { CustomerContactRecord, KillSwitchRecord, KillSwitchStatus } from '@sentinel/domain';
import { ApplicationError } from '../../../platform/errors/application-error.js';
import type { IdGenerator } from '../../../platform/ids/id-generator.js';
import type { Clock } from '../../../platform/time/clock.js';
import type { ActingContext, AuditTrail } from '../../audit/application/audit-trail.js';
import type { TenantAccessService } from '../../tenant-access/application/tenant-access.service.js';
import type {
  AccountControls,
  CustomerContactInput,
  KillSwitchActivation,
  KillSwitchLookup,
  WriteOutcome,
} from './account-controls.use-case.js';
import type { AccountControlRepository } from './ports/account-control-repository.port.js';
import type { CustomerNotificationPublisher } from './ports/customer-notification.port.js';

export const KILL_SWITCH_REASON_MAX_CHARS = 500;
export const CONTACT_NOTE_MAX_CHARS = 500;

/**
 * Contact customer and the account kill switch. Every write is tenant-checked, idempotent by key, appended and
 * audited. The kill switch is enforced in the decision path (DecisionService reads `activeKillSwitch`), never
 * only in the browser.
 */
export class AccountControlService implements AccountControls, KillSwitchLookup {
  constructor(
    private readonly controls: AccountControlRepository,
    private readonly notifications: CustomerNotificationPublisher,
    private readonly access: TenantAccessService,
    private readonly audit: AuditTrail,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async activeKillSwitch(accountId: string): Promise<KillSwitchRecord | null> {
    const latest = (await this.controls.killSwitchHistory(accountId)).at(-1);
    return latest?.state === 'ACTIVE' ? latest : null;
  }

  /** Analyst-initiated, with a reason. A retry with the same key returns the stored record; a second activation is a conflict. */
  async activateKillSwitch(context: ActingContext, activation: KillSwitchActivation): Promise<WriteOutcome<KillSwitchRecord>> {
    if (context.actor !== 'ANALYST' || !context.actorIdentity) {
      throw new ApplicationError('UNPROCESSABLE', 'An analyst identity is required to activate the kill switch');
    }
    const reason = activation.reason.trim();
    if (reason === '' || reason.length > KILL_SWITCH_REASON_MAX_CHARS) {
      throw new ApplicationError('UNPROCESSABLE', `A reason of 1 to ${KILL_SWITCH_REASON_MAX_CHARS} characters is required`);
    }
    const owner = await this.access.authoriseAccount(context, activation.accountId, 'account kill switch');
    const history = await this.controls.killSwitchHistory(activation.accountId);
    const replay = history.find((record) => record.idempotencyKey === activation.idempotencyKey);
    if (replay) return { outcome: 'DUPLICATE', record: replay };
    const latest = history.at(-1);
    if (latest?.state === 'ACTIVE') {
      throw new ApplicationError('CONFLICT', `The kill switch on ${activation.accountId} is already active`);
    }
    const record: KillSwitchRecord = {
      id: this.ids.next(),
      accountId: activation.accountId,
      previousState: latest?.state ?? 'NONE',
      state: 'ACTIVE',
      reason,
      actor: 'ANALYST',
      actorIdentity: context.actorIdentity,
      actedAt: this.clock.now().toISOString(),
      idempotencyKey: activation.idempotencyKey,
    };
    const written = await this.controls.appendKillSwitch(record, history.length);
    if (written.outcome === 'CREATED') {
      await this.audit.record(context, {
        category: 'KILL_SWITCH',
        action: 'KILL_SWITCH_ACTIVATED',
        outcome: 'SUCCEEDED',
        subject: { institutionId: owner.institutionId, accountId: activation.accountId },
      });
    }
    return written;
  }

  /** Only the customer's verification with the bank lifts the switch; the analyst cannot. */
  async liftKillSwitchAfterCustomerVerification(context: ActingContext, accountId: string, idempotencyKey: string): Promise<WriteOutcome<KillSwitchRecord>> {
    if (context.actor !== 'CUSTOMER') throw new ApplicationError('FORBIDDEN', 'Only customer verification lifts a kill switch');
    const owner = await this.access.authoriseAccount(context, accountId, 'account kill switch');
    const history = await this.controls.killSwitchHistory(accountId);
    const replay = history.find((record) => record.idempotencyKey === idempotencyKey);
    if (replay) return { outcome: 'DUPLICATE', record: replay };
    const latest = history.at(-1);
    if (latest?.state !== 'ACTIVE') throw new ApplicationError('CONFLICT', `No active kill switch on ${accountId}`);
    const record: KillSwitchRecord = {
      id: this.ids.next(),
      accountId,
      previousState: 'ACTIVE',
      state: 'LIFTED',
      reason: 'CUSTOMER_VERIFIED_WITH_BANK',
      actor: 'CUSTOMER',
      actedAt: this.clock.now().toISOString(),
      idempotencyKey,
    };
    const written = await this.controls.appendKillSwitch(record, history.length);
    if (written.outcome === 'CREATED') {
      await this.audit.record(context, {
        category: 'KILL_SWITCH',
        action: 'KILL_SWITCH_LIFTED_AFTER_CUSTOMER_VERIFICATION',
        outcome: 'SUCCEEDED',
        subject: { institutionId: owner.institutionId, accountId },
      });
    }
    return written;
  }

  async killSwitchStatus(context: ActingContext, accountId: string): Promise<KillSwitchStatus> {
    await this.access.authoriseAccount(context, accountId, 'account kill switch');
    const history = await this.controls.killSwitchHistory(accountId);
    return { accountId, active: history.at(-1)?.state === 'ACTIVE', history };
  }

  /** Records an attempt through the mock channel. It changes no hold: release still needs customer verification. */
  async recordContact(context: ActingContext, input: CustomerContactInput): Promise<WriteOutcome<CustomerContactRecord>> {
    if (context.actor !== 'ANALYST' || !context.actorIdentity) {
      throw new ApplicationError('UNPROCESSABLE', 'An analyst identity is required to record a customer contact');
    }
    const note = input.note?.trim();
    if (note !== undefined && note.length > CONTACT_NOTE_MAX_CHARS) {
      throw new ApplicationError('UNPROCESSABLE', `A note is at most ${CONTACT_NOTE_MAX_CHARS} characters`);
    }
    const owner = await this.access.authoriseAccount(context, input.accountId, 'customer contact', {
      ...(input.transactionId ? { transactionId: input.transactionId } : {}),
      ...(input.caseId ? { caseId: input.caseId } : {}),
    });
    const record: CustomerContactRecord = {
      id: this.ids.next(),
      accountId: input.accountId,
      ...(input.transactionId ? { transactionId: input.transactionId } : {}),
      ...(input.caseId ? { caseId: input.caseId } : {}),
      channel: input.channel,
      outcome: input.outcome,
      ...(note ? { note } : {}),
      actor: 'ANALYST',
      actorIdentity: context.actorIdentity,
      recordedAt: this.clock.now().toISOString(),
      idempotencyKey: input.idempotencyKey,
      simulated: true,
    };
    const written = await this.controls.appendContact(record);
    if (written.outcome === 'CREATED') {
      await this.notifications.notifyContactAttempt(written.record);
      await this.audit.record(context, {
        category: 'CUSTOMER_CONTACT',
        action: `CUSTOMER_CONTACT_${written.record.outcome}`,
        outcome: 'SUCCEEDED',
        subject: {
          institutionId: owner.institutionId,
          accountId: input.accountId,
          ...(input.transactionId ? { transactionId: input.transactionId } : {}),
          ...(input.caseId ? { caseId: input.caseId } : {}),
        },
        detail: `${written.record.channel} (simulated channel)`,
      });
    }
    return written;
  }

  async contacts(context: ActingContext, accountId: string): Promise<readonly CustomerContactRecord[]> {
    await this.access.authoriseAccount(context, accountId, 'customer contacts');
    return this.controls.contacts(accountId);
  }
}
