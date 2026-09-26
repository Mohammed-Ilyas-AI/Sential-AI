import type {
  AccountSecurityEvent,
  BankAccountReport,
  DecisionRequest,
  DecisionResponse,
  NetworkObservation,
  SecurityEventReceipt,
  TransactionEvent,
} from '@sentinel/domain';
import type { BankConnector } from '@sentinel/scenarios';
import type { HttpBankReportingClient } from '../bank-reporting/bank-reporting.client.js';
import type { DecisionApi } from '../decision-api/decision-api.client.js';
import type { TransactionEventPublisher } from '../pubsub-publisher/transaction-event.publisher.js';
import type { SecurityEventApi } from '../security-event-api/security-event-api.client.js';

/** The simulator's side of every bank interaction: HTTP to sentinel-core, lifecycle events through a publisher. */
export class SimulatorBankConnector implements BankConnector {
  constructor(
    private readonly reporting: HttpBankReportingClient,
    private readonly securityEvents: SecurityEventApi,
    private readonly decisions: DecisionApi,
    private readonly lifecycle: TransactionEventPublisher,
  ) {}

  reportAccount(report: BankAccountReport): Promise<void> {
    return this.reporting.reportAccount(report);
  }

  observeNetwork(observation: NetworkObservation): Promise<void> {
    return this.reporting.observeNetwork(observation);
  }

  recordSecurityEvent(event: AccountSecurityEvent): Promise<SecurityEventReceipt> {
    return this.securityEvents.record(event);
  }

  requestDecision(request: DecisionRequest): Promise<DecisionResponse> {
    return this.decisions.decide(request);
  }

  publishLifecycleEvent(event: TransactionEvent): Promise<void> {
    return this.lifecycle.publish(event);
  }
}
