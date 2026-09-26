import { RULESET_VERSION, type RapidDrainPolicy } from '@sentinel/domain';
import { assess, drainGate, RISK_RULES } from '@sentinel/rules';
import type { HttpRouteRegistration } from '../api/http-route-registration.js';
import { RuntimePolicyConfiguration } from '../infrastructure/configuration/runtime-policy-configuration.js';
import { transactionEventPushRoutes } from '../infrastructure/messaging/pubsub/transaction-event-consumer/transaction-event-push.routes.js';
import { MockPushCustomerNotificationPublisher } from '../infrastructure/notifications/mock-push-customer-notification.publisher.js';
import type { AccountStateRepository } from '../modules/accounts/application/ports/account-state-repository.port.js';
import type { OutflowWindowSource } from '../modules/accounts/application/ports/outflow-window-source.port.js';
import { RollingWindowService } from '../modules/accounts/application/rolling-window.service.js';
import { AlertService } from '../modules/alerts/application/alert.service.js';
import type { AlertRepository } from '../modules/alerts/application/ports/alert-repository.port.js';
import { DecisionService } from '../modules/decision/application/decision.service.js';
import type { DecisionRepository } from '../modules/decision/application/ports/decision-repository.port.js';
import { DecisionController } from '../modules/decision/presentation/decision.controller.js';
import { decisionRoutes } from '../modules/decision/presentation/decision.routes.js';
import { InterventionService } from '../modules/interventions/application/intervention.service.js';
import type { InterventionRepository } from '../modules/interventions/application/ports/intervention-repository.port.js';
import { PolicyGateService } from '../modules/policy/application/policy-gate.service.js';
import type { AssessmentRepository } from '../modules/risk/application/ports/assessment-repository.port.js';
import { RiskAssessmentService } from '../modules/risk/application/risk-assessment.service.js';
import type { SecurityEventLog } from '../modules/security-events/application/ports/security-event-log.port.js';
import { SecurityEventService } from '../modules/security-events/application/security-event.service.js';
import { SecurityEventController } from '../modules/security-events/presentation/security-event.controller.js';
import { securityEventRoutes } from '../modules/security-events/presentation/security-event.routes.js';
import type { TransactionEventLog } from '../modules/transactions/application/ports/transaction-event-log.port.js';
import type { TransactionProjectionRepository } from '../modules/transactions/application/ports/transaction-projection-repository.port.js';
import { TransactionProjectionService } from '../modules/transactions/application/transaction-projection.service.js';
import type { IdGenerator } from '../platform/ids/id-generator.js';
import type { Clock } from '../platform/time/clock.js';

export interface ControlPathPersistence {
  readonly decisions: DecisionRepository;
  readonly assessments: AssessmentRepository;
  readonly interventions: InterventionRepository;
  readonly accountStates: AccountStateRepository;
  readonly outflowWindow: OutflowWindowSource;
  readonly transactionEvents: TransactionEventLog;
  readonly transactionProjections: TransactionProjectionRepository;
  readonly securityEvents: SecurityEventLog;
  readonly alerts: AlertRepository;
}

export interface ControlPathDependencies {
  readonly persistence: ControlPathPersistence;
  readonly rapidDrainPolicy: RapidDrainPolicy;
  readonly designatedBillingPayeeIds: ReadonlySet<string>;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

export interface ControlPath {
  readonly routes: readonly HttpRouteRegistration[];
}

/**
 * Wires the synchronous control path. It receives no model gateway and imports nothing from the intelligence
 * path; the lint boundary enforces that. Rules decide.
 */
export function composeControlPath({
  persistence,
  rapidDrainPolicy,
  designatedBillingPayeeIds,
  clock,
  ids,
}: ControlPathDependencies): ControlPath {
  const transactionLifecycle = new TransactionProjectionService(
    persistence.transactionEvents,
    persistence.transactionProjections,
  );
  const decisions = new DecisionService({
    decisions: persistence.decisions,
    accounts: persistence.accountStates,
    rollingWindow: new RollingWindowService(persistence.outflowWindow),
    rapidDrainGate: new PolicyGateService(
      drainGate,
      new RuntimePolicyConfiguration(rapidDrainPolicy, designatedBillingPayeeIds),
    ),
    riskAssessment: new RiskAssessmentService(
      { assess, rules: RISK_RULES, rulesetVersion: RULESET_VERSION },
      persistence.assessments,
      ids,
    ),
    transactionLifecycle,
    interventions: new InterventionService(
      persistence.interventions,
      new MockPushCustomerNotificationPublisher(),
      clock,
      ids,
    ),
    alerts: new AlertService(persistence.alerts, ids),
    clock,
    ids,
  });
  const securityEvents = new SecurityEventService(persistence.securityEvents, persistence.accountStates);

  return {
    routes: [
      decisionRoutes(new DecisionController(decisions)),
      securityEventRoutes(new SecurityEventController(securityEvents)),
      transactionEventPushRoutes(transactionLifecycle),
    ],
  };
}
