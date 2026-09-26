import { NotYetImplementedError } from '@sentinel/domain';
import type { Scenario } from '@sentinel/scenarios';
import type { DecisionApi } from '../decision-api/decision-api.client.js';
import type { TransactionEventPublisher } from '../pubsub-publisher/transaction-event.publisher.js';
import type { SecurityEventApi } from '../security-event-api/security-event-api.client.js';
import type { ScenarioTimeline } from '../timeline/scenario-timeline.js';

export interface ScenarioRunnerDependencies {
  readonly decisions: DecisionApi;
  readonly securityEvents: SecurityEventApi;
  readonly lifecycleEvents: TransactionEventPublisher;
  readonly timeline: ScenarioTimeline;
}

/**
 * Plays the bank's payment orchestrator: security events first, then for every transfer ask for a decision
 * before committing, and only then publish the lifecycle events. A HOLD is never settled.
 */
export class ScenarioRunner {
  constructor(private readonly dependencies: ScenarioRunnerDependencies) {}

  run(scenario: Scenario): Promise<void> {
    throw new NotYetImplementedError(`Scenario runner for ${scenario.id}`, 'scheduled for build order step 2');
  }
}
