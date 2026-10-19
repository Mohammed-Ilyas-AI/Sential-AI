import type {
  AccountSecurityEvent,
  BankAccountReport,
  DecisionRequest,
  DecisionResponse,
  NetworkObservation,
  SecurityEventReceipt,
  TransactionEvent,
} from '@sentinel/domain';
import type { BankConnector, ScenarioTimeline } from '@sentinel/scenarios';
import type { RecordBankAccountReport } from '../../modules/accounts/application/record-bank-account-report.use-case.js';
import type { DecideTransaction } from '../../modules/decision/application/decide-transaction.use-case.js';
import type { RecordNetworkObservation } from '../../modules/graph/application/record-network-observation.use-case.js';
import type { RecordAccountSecurityEvent } from '../../modules/security-events/application/record-account-security-event.use-case.js';
import { resolveTraceId } from '../../platform/correlation/trace-id.js';

export interface InProcessBankPorts {
  readonly reports: RecordBankAccountReport;
  readonly observations: RecordNetworkObservation;
  readonly securityEvents: RecordAccountSecurityEvent;
  readonly decisions: DecideTransaction;
  readonly lifecycle: { apply(event: TransactionEvent): Promise<unknown> };
}

/**
 * The bank's side of the live demo, inside sentinel-core: the same use cases the HTTP routes and the Pub/Sub
 * push consumer call, so every transfer goes through the real gate. Synthetic scenario events only.
 */
export class InProcessBankConnector implements BankConnector {
  constructor(private readonly ports: InProcessBankPorts) {}

  async reportAccount(report: BankAccountReport): Promise<void> {
    await this.ports.reports.applyReport(report);
  }

  observeNetwork(observation: NetworkObservation): Promise<void> {
    return this.ports.observations.record(observation);
  }

  recordSecurityEvent(event: AccountSecurityEvent): Promise<SecurityEventReceipt> {
    return this.ports.securityEvents.record(event);
  }

  requestDecision(request: DecisionRequest): Promise<DecisionResponse> {
    return this.ports.decisions.decide(request, resolveTraceId(undefined));
  }

  async publishLifecycleEvent(event: TransactionEvent): Promise<void> {
    await this.ports.lifecycle.apply(event);
  }
}

/** Replays steps at their documented offsets from the moment the run starts. */
export class RealTimeTimeline implements ScenarioTimeline {
  private readonly startedAt = Date.now();

  async waitUntil(atMs: number): Promise<void> {
    const remaining = this.startedAt + atMs - Date.now();
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}
