import { RULESET_VERSION, type RapidDrainPolicy } from '@sentinel/domain';
import { assess, drainGate, RISK_RULES } from '@sentinel/rules';
import type { HttpRouteRegistration } from '../api/http-route-registration.js';
import { RuntimePolicyConfiguration } from '../infrastructure/configuration/runtime-policy-configuration.js';
import type { PushAuthenticator } from '../infrastructure/messaging/pubsub/push-authentication/push-authenticator.js';
import { transactionEventPushRoutes } from '../infrastructure/messaging/pubsub/transaction-event-consumer/transaction-event-push.routes.js';
import { MockPushCustomerNotificationPublisher } from '../infrastructure/notifications/mock-push-customer-notification.publisher.js';
import type { Logger } from '../infrastructure/telemetry/logger.js';
import { AccountReportService } from '../modules/accounts/application/account-report.service.js';
import type { AccountRepository } from '../modules/accounts/application/ports/account-repository.port.js';
import type { AccountSecurityStateRepository } from '../modules/accounts/application/ports/account-security-state-repository.port.js';
import type { OutflowWindowSource } from '../modules/accounts/application/ports/outflow-window-source.port.js';
import { RollingWindowService } from '../modules/accounts/application/rolling-window.service.js';
import { AccountController } from '../modules/accounts/presentation/account.controller.js';
import { accountRoutes } from '../modules/accounts/presentation/account.routes.js';
import { AlertService } from '../modules/alerts/application/alert.service.js';
import type { AlertRepository } from '../modules/alerts/application/ports/alert-repository.port.js';
import { DecisionService } from '../modules/decision/application/decision.service.js';
import type { DecisionRepository } from '../modules/decision/application/ports/decision-repository.port.js';
import { DecisionController } from '../modules/decision/presentation/decision.controller.js';
import { decisionRoutes } from '../modules/decision/presentation/decision.routes.js';
import { AccountControlService } from '../modules/interventions/application/account-controls.service.js';
import { InterventionService } from '../modules/interventions/application/intervention.service.js';
import type { AccountControlRepository } from '../modules/interventions/application/ports/account-control-repository.port.js';
import { AccountControlsController } from '../modules/interventions/presentation/account-controls.controller.js';
import { accountControlsRoutes } from '../modules/interventions/presentation/account-controls.routes.js';
import type { InterventionWorkflow } from '../modules/interventions/application/intervention-workflow.use-case.js';
import type { InterventionRepository } from '../modules/interventions/application/ports/intervention-repository.port.js';
import { InterventionController } from '../modules/interventions/presentation/intervention.controller.js';
import { interventionRoutes } from '../modules/interventions/presentation/intervention.routes.js';
import { PolicyGateService } from '../modules/policy/application/policy-gate.service.js';
import type { AssessmentRepository } from '../modules/risk/application/ports/assessment-repository.port.js';
import type { EntityLinkSource } from '../modules/risk/application/ports/entity-link-source.port.js';
import { RiskAssessmentService } from '../modules/risk/application/risk-assessment.service.js';
import type { SecurityEventLog } from '../modules/security-events/application/ports/security-event-log.port.js';
import { SecurityEventService } from '../modules/security-events/application/security-event.service.js';
import { SecurityEventController } from '../modules/security-events/presentation/security-event.controller.js';
import { securityEventRoutes } from '../modules/security-events/presentation/security-event.routes.js';
import type { TransactionEventLog } from '../modules/transactions/application/ports/transaction-event-log.port.js';
import type { TransactionProjectionRepository } from '../modules/transactions/application/ports/transaction-projection-repository.port.js';
import { TransactionProjectionService } from '../modules/transactions/application/transaction-projection.service.js';
import type { AuditTrail } from '../modules/audit/application/audit-trail.js';
import type { TenantAccessService } from '../modules/tenant-access/application/tenant-access.service.js';
import type { IdGenerator } from '../platform/ids/id-generator.js';
import type { Clock } from '../platform/time/clock.js';

export interface ControlPathPersistence {
  readonly decisions: DecisionRepository;
  readonly assessments: AssessmentRepository;
  readonly interventions: InterventionRepository;
  readonly accounts: AccountRepository;
  readonly securityStates: AccountSecurityStateRepository;
  readonly outflowWindow: OutflowWindowSource;
  readonly transactionEvents: TransactionEventLog;
  readonly transactionProjections: TransactionProjectionRepository;
  readonly securityEvents: SecurityEventLog;
  readonly alerts: AlertRepository;
  readonly entityLinks: EntityLinkSource;
  readonly accountControls: AccountControlRepository;
}

export interface ControlPathDependencies {
  readonly persistence: ControlPathPersistence;
  readonly rapidDrainPolicy: RapidDrainPolicy;
  readonly designatedBillingPayeeIds: ReadonlySet<string>;
  readonly demoTimeCompression: boolean;
  readonly pushAuthenticator: PushAuthenticator;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly logger: Logger;
  readonly audit: AuditTrail;
  readonly tenantAccess: TenantAccessService;
}

export interface ControlPath {
  readonly routes: readonly HttpRouteRegistration[];
  readonly interventions: InterventionWorkflow;
  readonly accountControls: AccountControlService;
}

/**
 * Wires the synchronous control path. It receives no model gateway and imports nothing from the intelligence
 * path; the lint boundary enforces that. Rules decide.
 */
export function composeControlPath(dependencies: ControlPathDependencies): ControlPath {
  const { persistence, clock, ids } = dependencies;
  const policy = new RuntimePolicyConfiguration(
    dependencies.rapidDrainPolicy,
    dependencies.designatedBillingPayeeIds,
    dependencies.demoTimeCompression,
  );
  const rollingWindow = new RollingWindowService(persistence.outflowWindow, policy);
  const transactionLifecycle = new TransactionProjectionService(persistence.transactionEvents, persistence.transactionProjections);
  const notifications = new MockPushCustomerNotificationPublisher(dependencies.logger);
  const interventions = new InterventionService(persistence.interventions, notifications, clock, ids);
  const accountControls = new AccountControlService(
    persistence.accountControls,
    notifications,
    dependencies.tenantAccess,
    dependencies.audit,
    clock,
    ids,
  );
  const decisions = new DecisionService({
    decisions: persistence.decisions,
    accounts: persistence.accounts,
    securityStates: persistence.securityStates,
    entityLinks: persistence.entityLinks,
    rollingWindow,
    rapidDrainGate: new PolicyGateService(drainGate, policy),
    riskAssessment: new RiskAssessmentService({ assess, rules: RISK_RULES, rulesetVersion: RULESET_VERSION }, persistence.assessments, ids),
    transactionLifecycle,
    interventions,
    killSwitches: accountControls,
    alerts: new AlertService(persistence.alerts, ids),
    clock,
    ids,
  });
  const securityEvents = new SecurityEventService({
    events: persistence.securityEvents,
    accounts: persistence.accounts,
    securityStates: persistence.securityStates,
    rollingWindow,
    policy,
    rules: RISK_RULES,
  });

  return {
    routes: [
      accountRoutes(new AccountController(new AccountReportService(persistence.accounts, policy))),
      decisionRoutes(new DecisionController(decisions)),
      securityEventRoutes(new SecurityEventController(securityEvents)),
      interventionRoutes(new InterventionController(interventions, dependencies.tenantAccess)),
      accountControlsRoutes(new AccountControlsController(accountControls)),
      transactionEventPushRoutes(transactionLifecycle, dependencies.pushAuthenticator),
    ],
    interventions,
    accountControls,
  };
}
