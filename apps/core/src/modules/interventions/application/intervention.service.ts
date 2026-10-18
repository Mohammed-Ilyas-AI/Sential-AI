import {
  DECISION_REASON,
  INTERVENTION_REASON,
  type DecisionRecord,
  type Intervention,
  type InterventionActor,
  type InterventionState,
  type IsoTimestamp,
} from '@sentinel/domain';
import { ApplicationError } from '../../../platform/errors/application-error.js';
import type { IdGenerator } from '../../../platform/ids/id-generator.js';
import type { Clock } from '../../../platform/time/clock.js';
import type { InterventionWorkflow } from './intervention-workflow.use-case.js';
import type { CustomerNotificationPublisher } from './ports/customer-notification.port.js';
import type { InterventionRepository } from './ports/intervention-repository.port.js';

interface Transition {
  readonly state: Exclude<InterventionState, 'HELD'>;
  readonly actor: InterventionActor;
  readonly reason: string;
  readonly actorIdentity?: string;
  readonly actedAt: IsoTimestamp;
}

export class InterventionService implements InterventionWorkflow {
  constructor(
    private readonly interventions: InterventionRepository,
    private readonly notifications: CustomerNotificationPublisher,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  /**
   * Evaluating → Held, by the system, immediately, with the customer notified. Idempotent per transaction.
   * A cascaded hold records the cascade reason and the transaction that triggered it; a kill-switch hold records
   * the kill switch and has no holdUntil, so only customer verification (or cancellation, or rejection) ends it.
   */
  async placeHold(decision: DecisionRecord): Promise<Intervention> {
    const history = await this.interventions.findByTransactionId(decision.transactionId);
    const latest = history.at(-1);
    if (latest) return latest;

    const reason = decision.reasonCodes.includes(DECISION_REASON.killSwitch)
      ? INTERVENTION_REASON.killSwitch
      : decision.reasonCodes.includes(DECISION_REASON.holdCascade)
        ? INTERVENTION_REASON.holdCascade
        : INTERVENTION_REASON.thresholdExceeded;
    const hold: Intervention = {
      id: this.ids.next(),
      decisionId: decision.decisionId,
      transactionId: decision.transactionId,
      accountId: decision.accountId,
      previousState: 'EVALUATING',
      state: 'HELD',
      ...(decision.holdUntil ? { holdUntil: decision.holdUntil } : {}),
      ...(decision.cascadeOfTransactionId ? { cascadeOfTransactionId: decision.cascadeOfTransactionId } : {}),
      reasonCodes: [reason],
      actor: 'SYSTEM',
      actedAt: decision.decidedAt,
      policyVersion: decision.policyVersion,
      rulesetVersion: decision.rulesetVersion,
      assessment: decision.assessment,
    };
    await this.interventions.append(hold);
    await this.notifications.notifyHold(hold);
    return hold;
  }

  /**
   * A threshold hold keeps the account in the hold state for outflows occurring at or after the transfer that
   * breached it, until its cooling period ends or the customer verifies and it is released. A customer
   * cancellation or an analyst fraud rejection leaves the account held: neither is evidence the account is safe.
   * Cascaded holds never extend the cascade themselves; only a new threshold breach does.
   */
  async activeHoldCascade(accountId: string, occurredAt: IsoTimestamp, at: IsoTimestamp): Promise<Intervention | null> {
    const histories = new Map<string, Intervention[]>();
    for (const record of await this.interventions.findByAccountId(accountId)) {
      histories.set(record.transactionId, [...(histories.get(record.transactionId) ?? []), record]);
    }
    let active: Intervention | null = null;
    for (const history of histories.values()) {
      const trigger = history.find((record) => record.previousState === 'EVALUATING');
      if (!trigger?.holdUntil || !trigger.reasonCodes.includes(INTERVENTION_REASON.thresholdExceeded)) continue;
      const covers =
        Date.parse(occurredAt) >= Date.parse(trigger.assessment.evaluatedAt) &&
        Date.parse(at) < Date.parse(trigger.holdUntil) &&
        !history.some((record) => record.state === 'RELEASED');
      if (covers && (!active?.holdUntil || Date.parse(trigger.holdUntil) > Date.parse(active.holdUntil))) active = trigger;
    }
    return active;
  }

  /** Held → Released by the system once the 24-hour cooling period has elapsed. */
  async releaseDueHolds(now: IsoTimestamp): Promise<number> {
    const due = await this.interventions.findHeldDueForRelease(now);
    for (const hold of due) {
      await this.append(hold, {
        state: 'RELEASED',
        actor: 'SYSTEM',
        reason: INTERVENTION_REASON.coolingPeriodElapsed,
        actedAt: now,
      });
    }
    return due.length;
  }

  /** Held → Released on the published expedited route, only once the customer has verified with the bank. */
  releaseAfterCustomerVerification(transactionId: string): Promise<Intervention> {
    return this.transition(transactionId, {
      state: 'RELEASED',
      actor: 'CUSTOMER',
      reason: INTERVENTION_REASON.customerVerifiedRelease,
      actedAt: this.clock.now().toISOString(),
    });
  }

  /** Held → Cancelled when the customer identifies the transfer as fraudulent. */
  cancelByCustomer(transactionId: string): Promise<Intervention> {
    return this.transition(transactionId, {
      state: 'CANCELLED',
      actor: 'CUSTOMER',
      reason: INTERVENTION_REASON.customerCancelled,
      actedAt: this.clock.now().toISOString(),
    });
  }

  /** Held → Rejected: escalation only, always recorded with the analyst identity. */
  rejectAsConfirmedFraud(transactionId: string, analystIdentity: string): Promise<Intervention> {
    if (analystIdentity.trim() === '') {
      return Promise.reject(new ApplicationError('UNPROCESSABLE', 'An analyst identity is required to reject'));
    }
    return this.transition(transactionId, {
      state: 'REJECTED',
      actor: 'ANALYST',
      reason: INTERVENTION_REASON.analystConfirmedFraud,
      actorIdentity: analystIdentity,
      actedAt: this.clock.now().toISOString(),
    });
  }

  history(transactionId: string): Promise<readonly Intervention[]> {
    return this.interventions.findByTransactionId(transactionId);
  }

  private async transition(transactionId: string, transition: Transition): Promise<Intervention> {
    const latest = (await this.interventions.findByTransactionId(transactionId)).at(-1);
    if (!latest) throw new ApplicationError('NOT_FOUND', `No intervention exists for ${transactionId}`);
    if (latest.state !== 'HELD') {
      throw new ApplicationError('CONFLICT', `${transactionId} is ${latest.state}; only a HELD transfer can move`);
    }
    return this.append(latest, transition);
  }

  private async append(latest: Intervention, transition: Transition): Promise<Intervention> {
    const record: Intervention = {
      id: this.ids.next(),
      decisionId: latest.decisionId,
      transactionId: latest.transactionId,
      accountId: latest.accountId,
      previousState: latest.state,
      state: transition.state,
      ...(latest.cascadeOfTransactionId ? { cascadeOfTransactionId: latest.cascadeOfTransactionId } : {}),
      reasonCodes: [transition.reason],
      actor: transition.actor,
      ...(transition.actorIdentity ? { actorIdentity: transition.actorIdentity } : {}),
      actedAt: transition.actedAt,
      policyVersion: latest.policyVersion,
      rulesetVersion: latest.rulesetVersion,
      assessment: latest.assessment,
    };
    await this.interventions.append(record);
    return record;
  }
}
