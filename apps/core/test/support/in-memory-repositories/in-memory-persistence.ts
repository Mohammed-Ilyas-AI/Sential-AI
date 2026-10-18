import type { SentinelPersistence } from '../../../src/composition/mongo-persistence.composition.js';
import { InMemoryAccountStateRepository } from './in-memory-account-state.repository.js';
import { InMemoryDecisionRepository } from './in-memory-decision.repository.js';
import { InMemoryEvidenceSource, InMemoryExplanationCache } from './in-memory-evidence.source.js';
import { InMemoryGraphStore } from './in-memory-graph.store.js';
import { InMemoryInterventionRepository } from './in-memory-intervention.repository.js';
import { InMemoryAccountControlRepository, InMemoryAuditLog } from './in-memory-operations.stores.js';
import { InMemoryCaseReportRepository, InMemoryCaseRepository, InMemoryCaseSummaryArchive } from './in-memory-case.stores.js';
import { InMemoryAlertRepository, InMemoryAssessmentRepository, InMemorySecurityEventLog } from './in-memory-simple-stores.js';
import { InMemoryTransactionStore } from './in-memory-transaction-store.js';

export interface InMemoryPersistence extends SentinelPersistence {
  readonly alertStore: InMemoryAlertRepository;
  readonly transactionStore: InMemoryTransactionStore;
  readonly auditLog: InMemoryAuditLog;
  readonly caseStore: InMemoryCaseRepository;
}

/** Every control-path port backed in memory, sharing state exactly as the MongoDB adapters share collections. */
export function createInMemoryPersistence(): InMemoryPersistence {
  const accountState = new InMemoryAccountStateRepository();
  const transactionStore = new InMemoryTransactionStore();
  const graph = new InMemoryGraphStore({ accounts: accountState, transactions: transactionStore });
  const alertStore = new InMemoryAlertRepository();
  const assessments = new InMemoryAssessmentRepository();
  const interventions = new InMemoryInterventionRepository();
  const securityEvents = new InMemorySecurityEventLog();
  const caseStore = new InMemoryCaseRepository();
  return {
    decisions: new InMemoryDecisionRepository(),
    assessments,
    interventions,
    accounts: accountState,
    securityStates: accountState,
    outflowWindow: transactionStore,
    transactionEvents: transactionStore,
    transactionProjections: transactionStore,
    securityEvents,
    alerts: alertStore,
    entityLinks: graph,
    accountControls: new InMemoryAccountControlRepository(),
    auditLog: new InMemoryAuditLog(),
    reports: new InMemoryCaseReportRepository(),
    summaries: new InMemoryCaseSummaryArchive(),
    graph,
    alertStore,
    transactionStore,
    evidence: new InMemoryEvidenceSource({
      accounts: accountState,
      assessments,
      transactions: transactionStore,
      securityEvents,
      alerts: alertStore,
      interventions,
      graph,
    }),
    cases: caseStore,
    caseStore,
    explanations: new InMemoryExplanationCache(),
  };
}
