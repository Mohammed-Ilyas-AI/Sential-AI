import type { DecisionResponse } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { IdGenerator } from '../../../platform/ids/id-generator.js';
import type { Clock } from '../../../platform/time/clock.js';
import type { ComputeRollingWindow } from '../../accounts/application/compute-rolling-window.use-case.js';
import type { AccountStateRepository } from '../../accounts/application/ports/account-state-repository.port.js';
import type { RaiseAlert } from '../../alerts/application/raise-alert.use-case.js';
import type { InterventionWorkflow } from '../../interventions/application/intervention-workflow.use-case.js';
import type { EvaluateRapidDrainGate } from '../../policy/application/evaluate-rapid-drain-gate.use-case.js';
import type { AssessTransactionRisk } from '../../risk/application/assess-transaction-risk.use-case.js';
import type { ApplyTransactionLifecycleEvent } from '../../transactions/application/apply-transaction-lifecycle-event.use-case.js';
import type { DecideTransaction } from './decide-transaction.use-case.js';
import type { DecisionRepository } from './ports/decision-repository.port.js';

export interface DecisionServiceDependencies {
  readonly decisions: DecisionRepository;
  readonly accounts: AccountStateRepository;
  readonly rollingWindow: ComputeRollingWindow;
  readonly rapidDrainGate: EvaluateRapidDrainGate;
  readonly riskAssessment: AssessTransactionRisk;
  readonly transactionLifecycle: ApplyTransactionLifecycleEvent;
  readonly interventions: InterventionWorkflow;
  readonly alerts: RaiseAlert;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

/**
 * The synchronous control path: idempotency check, rolling window, drain gate, risk assessment, decision
 * record, initial PENDING projection, hold on HOLD. Never waits on Pub/Sub; no language model anywhere.
 */
export class DecisionService implements DecideTransaction {
  constructor(private readonly dependencies: DecisionServiceDependencies) {}

  decide(): Promise<DecisionResponse> {
    throw new NotYetImplementedError('Pre-transaction decision', 'scheduled for build order step 3');
  }
}
