import type {
  AccountSecurityEvent,
  AccountSecurityEventType,
  BankAccountReport,
  DecisionRequest,
  InstitutionId,
  MinorUnits,
  TransactionEvent,
  TransactionLifecycleStatus,
  TransactionType,
} from '@sentinel/domain';
import { syntheticToken } from '../identity/synthetic-token.js';
import { SYNTHETIC_AMOUNT_P95, homeDeviceOf, type SyntheticAccount, ESTABLISHED_PAYEES } from './synthetic-roster.js';

const HOUR_MS = 3_600_000;

export interface TransferSpecification {
  readonly source: SyntheticAccount;
  readonly payeeId: string;
  readonly destinationInstitutionId: InstitutionId;
  readonly amount: MinorUnits;
  readonly deviceId: string;
  readonly occurredAt: string;
  readonly type?: TransactionType;
}

/**
 * Builds canonical, tokenised events for a scenario. Holds the per-account sequence so every event for an
 * account is strictly ordered, exactly as a bank's orchestrator would number them.
 */
export class ScenarioEventFactory {
  private readonly sequences = new Map<string, number>();
  private transactionCount = 0;
  private securityCount = 0;

  constructor(
    private readonly scenarioCode: string,
    private readonly epochMs: number,
  ) {}

  at(offsetMs: number): string {
    return new Date(this.epochMs + offsetMs).toISOString();
  }

  hoursBefore(hours: number): string {
    return new Date(this.epochMs - hours * HOUR_MS).toISOString();
  }

  accountReport(account: SyntheticAccount, balance: MinorUnits, velocityRatio: number, observedAt: string): BankAccountReport {
    return {
      schemaVersion: '1.0',
      tenantId: account.institutionId,
      accountToken: syntheticToken('acct', account.displayId),
      institutionId: account.institutionId,
      displayReference: account.displayId,
      openedAt: account.openedAt,
      balance,
      balanceAsOf: this.hoursBefore(24),
      knownDeviceTokens: [syntheticToken('dev', homeDeviceOf(account.displayId))],
      knownPayeeTokens: ESTABLISHED_PAYEES.map((payee) => syntheticToken('ben', payee)),
      behaviour: { velocityRatio, amountP95: SYNTHETIC_AMOUNT_P95, observedAt },
    };
  }

  securityEvent(
    account: SyntheticAccount,
    eventType: AccountSecurityEventType,
    occurredAt: string,
    subject: { readonly deviceId?: string; readonly payeeId?: string } = {},
  ): AccountSecurityEvent {
    this.securityCount += 1;
    const eventId = `SEC-${this.scenarioCode}-${String(this.securityCount).padStart(4, '0')}`;
    return {
      schemaVersion: '1.0',
      tenantId: account.institutionId,
      eventId,
      idempotencyKey: `idem-${eventId}`,
      accountToken: syntheticToken('acct', account.displayId),
      eventType,
      ...(subject.deviceId ? { deviceToken: syntheticToken('dev', subject.deviceId) } : {}),
      ...(subject.payeeId ? { beneficiaryToken: syntheticToken('ben', subject.payeeId) } : {}),
      occurredAt,
    };
  }

  /** The PENDING decision request plus the AUTHORISED and SETTLED events published only if it is allowed. */
  transfer(specification: TransferSpecification): {
    readonly request: DecisionRequest;
    readonly lifecycleOnAllow: readonly TransactionEvent[];
  } {
    this.transactionCount += 1;
    const transactionId = `TX-${this.scenarioCode}-${String(this.transactionCount).padStart(4, '0')}`;
    const event = (status: TransactionLifecycleStatus, occurredAt: string): TransactionEvent => ({
      schemaVersion: '1.0',
      tenantId: specification.source.institutionId,
      eventId: `EVT-${transactionId}-${status}`,
      idempotencyKey: `idem-${transactionId}-${status}`,
      accountSequence: this.nextSequence(specification.source.displayId),
      transactionId,
      status,
      sourceAccountToken: syntheticToken('acct', specification.source.displayId),
      destinationInstitutionId: specification.destinationInstitutionId,
      destinationAccountToken: syntheticToken('acct', specification.payeeId),
      networkReference: `FAST-${transactionId}`,
      deviceToken: syntheticToken('dev', specification.deviceId),
      beneficiaryToken: syntheticToken('ben', specification.payeeId),
      amount: specification.amount,
      currency: 'SGD',
      channel: 'APP',
      type: specification.type ?? 'TRANSFER',
      occurredAt,
    });

    const request = event('PENDING', specification.occurredAt) as DecisionRequest;
    const settleAt = new Date(Date.parse(specification.occurredAt) + 500).toISOString();
    return { request, lifecycleOnAllow: [event('AUTHORISED', settleAt), event('SETTLED', settleAt)] };
  }

  homeDevice(account: SyntheticAccount): string {
    return homeDeviceOf(account.displayId);
  }

  private nextSequence(displayId: string): number {
    const next = (this.sequences.get(displayId) ?? 0) + 1;
    this.sequences.set(displayId, next);
    return next;
  }
}
