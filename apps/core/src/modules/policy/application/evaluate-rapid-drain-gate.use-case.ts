import type { DrainState, IsoTimestamp, RapidDrainPolicy, RollingWindow, Transaction } from '@sentinel/domain';

export interface RapidDrainGateOutcome {
  readonly drain: DrainState;
  readonly protected: boolean;
  readonly policy: RapidDrainPolicy;
}

/** The published SG-RD-50 control: a fact, never a probability. */
export interface EvaluateRapidDrainGate {
  evaluate(transaction: Transaction, window: RollingWindow): RapidDrainGateOutcome;
  holdUntil(decidedAt: Date): IsoTimestamp;
}
