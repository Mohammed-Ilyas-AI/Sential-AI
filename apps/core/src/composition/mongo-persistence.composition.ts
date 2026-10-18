import type { MongoDatabase } from '../infrastructure/database/mongodb/client/mongo-connection.js';
import { MongoAccountStateRepository } from '../infrastructure/database/mongodb/repositories/mongo-account-state.repository.js';
import { MongoAccountControlRepository } from '../infrastructure/database/mongodb/repositories/mongo-account-control.repository.js';
import { MongoAuditLog } from '../infrastructure/database/mongodb/repositories/mongo-audit.log.js';
import { MongoAlertRepository } from '../infrastructure/database/mongodb/repositories/mongo-alert.repository.js';
import { MongoAssessmentRepository } from '../infrastructure/database/mongodb/repositories/mongo-assessment.repository.js';
import { MongoCaseRepository } from '../infrastructure/database/mongodb/repositories/mongo-case.repository.js';
import { MongoCaseReportRepository } from '../infrastructure/database/mongodb/repositories/mongo-case-report.repository.js';
import { MongoCaseSummaryArchive } from '../infrastructure/database/mongodb/repositories/mongo-case-summary.archive.js';
import { MongoDecisionRepository } from '../infrastructure/database/mongodb/repositories/mongo-decision.repository.js';
import { MongoEntityLinkSource } from '../infrastructure/database/mongodb/repositories/mongo-entity-link.source.js';
import { MongoEvidenceSource } from '../infrastructure/database/mongodb/repositories/mongo-evidence.source.js';
import { MongoExplanationCache } from '../infrastructure/database/mongodb/repositories/mongo-explanation.cache.js';
import { MongoGraphRepository } from '../infrastructure/database/mongodb/repositories/mongo-graph.repository.js';
import { MongoInterventionRepository } from '../infrastructure/database/mongodb/repositories/mongo-intervention.repository.js';
import { MongoOutflowWindowSource } from '../infrastructure/database/mongodb/repositories/mongo-outflow-window.source.js';
import { MongoSecurityEventLog } from '../infrastructure/database/mongodb/repositories/mongo-security-event.log.js';
import { MongoTransactionEventLog } from '../infrastructure/database/mongodb/repositories/mongo-transaction-event.log.js';
import { MongoTransactionProjectionRepository } from '../infrastructure/database/mongodb/repositories/mongo-transaction-projection.repository.js';
import type { ControlPathPersistence } from './control-path.composition.js';
import type { AuditLog } from '../modules/audit/application/ports/audit-log.port.js';
import type { ScenarioRunRepository } from '../modules/scenarios/application/ports/scenario-run-repository.port.js';
import { MongoScenarioRunRepository } from '../infrastructure/database/mongodb/repositories/mongo-scenario-run.repository.js';
import type { IntelligencePathPersistence } from './intelligence-path.composition.js';

/** Shared by both paths: the append-only audit events. */
export interface OperationsPersistence {
  readonly auditLog: AuditLog;
  readonly scenarioRuns: ScenarioRunRepository;
}

export type SentinelPersistence = ControlPathPersistence & IntelligencePathPersistence & OperationsPersistence;

/** The only place MongoDB adapters are constructed. Swapping a store means changing this file, not a service. */
export function composeMongoPersistence(database: MongoDatabase): SentinelPersistence {
  const accountState = new MongoAccountStateRepository(database);
  return {
    decisions: new MongoDecisionRepository(database),
    assessments: new MongoAssessmentRepository(database),
    interventions: new MongoInterventionRepository(database),
    accounts: accountState,
    securityStates: accountState,
    outflowWindow: new MongoOutflowWindowSource(database),
    transactionEvents: new MongoTransactionEventLog(database),
    transactionProjections: new MongoTransactionProjectionRepository(database),
    securityEvents: new MongoSecurityEventLog(database),
    alerts: new MongoAlertRepository(database),
    entityLinks: new MongoEntityLinkSource(database),
    accountControls: new MongoAccountControlRepository(database),
    auditLog: new MongoAuditLog(database),
    scenarioRuns: new MongoScenarioRunRepository(database),
    evidence: new MongoEvidenceSource(database),
    cases: new MongoCaseRepository(database),
    reports: new MongoCaseReportRepository(database),
    summaries: new MongoCaseSummaryArchive(database),
    graph: new MongoGraphRepository(database),
    explanations: new MongoExplanationCache(database),
  };
}
