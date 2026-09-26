import type { DrainState, RollingWindow, Transaction } from '@sentinel/domain';

export interface RapidDrainGateOutcome {
  readonly drain: DrainState;
  readonly policyVersion: string;
}

/** The published SG-RD-50 control: a fact, never a probability. */
export interface EvaluateRapidDrainGate {
  evaluate(transaction: Transaction, window: RollingWindow): RapidDrainGateOutcome;
}
