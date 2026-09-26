import type {
  AccountSecurityEvent,
  BankAccountReport,
  DecisionRequest,
  NetworkObservation,
  TransactionEvent,
} from '@sentinel/domain';

interface TimedStep {
  /** Offset from scenario start; occurredAt timestamps inside the payloads are independent of it. */
  readonly atMs: number;
}

export type ScenarioStep =
  | (TimedStep & { readonly action: 'REPORT_ACCOUNT'; readonly report: BankAccountReport })
  | (TimedStep & { readonly action: 'OBSERVE_NETWORK'; readonly observation: NetworkObservation })
  | (TimedStep & {
      readonly action: 'LOGIN_NEW_DEVICE' | 'ADD_PAYEE' | 'SECURITY_EVENT';
      readonly event: AccountSecurityEvent;
    })
  | (TimedStep & {
      readonly action: 'TRANSFER';
      readonly request: DecisionRequest;
      /** Published only when the decision is ALLOW; a held transfer is never settled. */
      readonly lifecycleOnAllow: readonly TransactionEvent[];
    })
  | (TimedStep & { readonly action: 'NOOP' });

export type ScenarioAction = ScenarioStep['action'];

/** The same seed and epoch produce the same stream, the same scores and the same hold, every run. */
export interface Scenario {
  readonly id: string;
  readonly seed: number;
  readonly epoch: string;
  readonly timeline: readonly ScenarioStep[];
}
