import { NotYetImplementedError } from '@sentinel/domain';
import type { SentinelPersistence } from '../../../src/composition/mongo-persistence.composition.js';
import { InMemoryAccountStateRepository } from './in-memory-account-state.repository.js';
import { InMemoryDecisionRepository } from './in-memory-decision.repository.js';
import { InMemoryEvidenceSource, InMemoryExplanationCache } from './in-memory-evidence.source.js';
import { InMemoryGraphStore } from './in-memory-graph.store.js';
import { InMemoryInterventionRepository } from './in-memory-intervention.repository.js';
import { InMemoryAlertRepository, InMemoryAssessmentRepository, InMemorySecurityEventLog } from './in-memory-simple-stores.js';
import { InMemoryTransactionStore } from './in-memory-transaction-store.js';

const unbuilt = (capability: string): never => {
  throw new NotYetImplementedError(capability, 'case workflow, scheduled for build order step 10');
};

export interface InMemoryPersistence extends SentinelPersistence {
  readonly alertStore: InMemoryAlertRepository;
  readonly transactionStore: InMemoryTransactionStore;
}

/** Every control-path port backed in memory, sharing state exactly as the MongoDB adapters share collections. */
export function createInMemoryPersistence(): InMemoryPersistence {
  const accountState = new InMemoryAccountStateRepository();
  const transactionStore = new InMemoryTransactionStore();
  const graph = new InMemoryGraphStore();
  const alertStore = new InMemoryAlertRepository();
  const assessments = new InMemoryAssessmentRepository();
  const interventions = new InMemoryInterventionRepository();
  const securityEvents = new InMemorySecurityEventLog();
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
    cases: {
      open: () => unbuilt('Case repository'),
      findById: () => unbuilt('Case repository'),
      changeStatus: () => unbuilt('Case repository'),
      attachSummary: () => unbuilt('Case repository'),
    },
    explanations: new InMemoryExplanationCache(),
  };
}
