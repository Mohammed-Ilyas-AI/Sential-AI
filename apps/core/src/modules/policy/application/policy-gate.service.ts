import { NotYetImplementedError } from '@sentinel/domain';
import type { DrainGate } from '@sentinel/rules';
import type { EvaluateRapidDrainGate, RapidDrainGateOutcome } from './evaluate-rapid-drain-gate.use-case.js';
import type { PolicyConfiguration } from './ports/policy-configuration.port.js';

/** Applies @sentinel/rules drainGate with the configured policy and stamps the policy version. */
export class PolicyGateService implements EvaluateRapidDrainGate {
  constructor(
    private readonly drainGate: DrainGate,
    private readonly configuration: PolicyConfiguration,
  ) {}

  evaluate(): RapidDrainGateOutcome {
    throw new NotYetImplementedError('Rapid-drain policy gate', 'scheduled for build order step 7');
  }
}
