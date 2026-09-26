import type { IsoTimestamp, RollingWindow, Transaction } from '@sentinel/domain';
import { isProtectedAtWindowStart, type DrainGate } from '@sentinel/rules';
import type { EvaluateRapidDrainGate, RapidDrainGateOutcome } from './evaluate-rapid-drain-gate.use-case.js';
import type { PolicyConfiguration } from './ports/policy-configuration.port.js';

/** Applies @sentinel/rules drainGate with the configured policy. Independent of the advisory score. */
export class PolicyGateService implements EvaluateRapidDrainGate {
  constructor(
    private readonly drainGate: DrainGate,
    private readonly configuration: PolicyConfiguration,
  ) {}

  evaluate(transaction: Transaction, window: RollingWindow): RapidDrainGateOutcome {
    const policy = this.configuration.rapidDrainPolicy();
    return {
      drain: this.drainGate(transaction, window, policy, this.configuration.designatedBillingOrganisations()),
      protected: isProtectedAtWindowStart(window, policy),
      policy,
    };
  }

  holdUntil(decidedAt: Date): IsoTimestamp {
    return new Date(decidedAt.getTime() + this.configuration.holdDurationMs()).toISOString();
  }
}
