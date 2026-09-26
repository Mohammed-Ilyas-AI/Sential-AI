import type {
  AccountSecurityEvent,
  BankAccountReport,
  DecisionRequest,
  DecisionResponse,
  NetworkObservation,
  SecurityEventReceipt,
  TransactionEvent,
} from '@sentinel/domain';

/**
 * Everything a participating bank does against SENTINEL. The simulator implements it over HTTP and Pub/Sub;
 * tests implement it in-process. Playback never knows which.
 */
export interface BankConnector {
  reportAccount(report: BankAccountReport): Promise<void>;
  observeNetwork(observation: NetworkObservation): Promise<void>;
  recordSecurityEvent(event: AccountSecurityEvent): Promise<SecurityEventReceipt>;
  requestDecision(request: DecisionRequest): Promise<DecisionResponse>;
  publishLifecycleEvent(event: TransactionEvent): Promise<void>;
}

/** Waits until a step's offset. Real time for the live demo, no waiting for tests. */
export interface ScenarioTimeline {
  waitUntil(atMs: number): Promise<void>;
}

export const INSTANT_TIMELINE: ScenarioTimeline = { waitUntil: async () => undefined };
