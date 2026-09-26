import { NotYetImplementedError } from '@sentinel/domain';
import type { SentinelPersistence } from '../../../src/composition/mongo-persistence.composition.js';
import { InMemoryAccountStateRepository } from './in-memory-account-state.repository.js';
import { InMemoryDecisionRepository } from './in-memory-decision.repository.js';
import { InMemoryGraphStore } from './in-memory-graph.store.js';
import { InMemoryInterventionRepository } from './in-memory-intervention.repository.js';
import { InMemoryAlertRepository, InMemoryAssessmentRepository, InMemorySecurityEventLog } from './in-memory-simple-stores.js';
import { InMemoryTransactionStore } from './in-memory-transaction-store.js';

const unbuilt = (capability: string): never => {
  throw new NotYetImplementedError(capability, 'intelligence path, scheduled for build order steps 9-10');
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
  return {
    decisions: new InMemoryDecisionRepository(),
    assessments: new InMemoryAssessmentRepository(),
    interventions: new InMemoryInterventionRepository(),
    accounts: accountState,
    securityStates: accountState,
    outflowWindow: transactionStore,
    transactionEvents: transactionStore,
    transactionProjections: transactionStore,
    securityEvents: new InMemorySecurityEventLog(),
    alerts: alertStore,
    entityLinks: graph,
    graph,
    alertStore,
    transactionStore,
    evidence: {
      accountProfile: () => unbuilt('Evidence source'),
      assessment: () => unbuilt('Evidence source'),
      recentTransactions: () => unbuilt('Evidence source'),
      deviceHistory: () => unbuilt('Evidence source'),
      payeeHistory: () => unbuilt('Evidence source'),
      priorAlerts: () => unbuilt('Evidence source'),
      interventions: () => unbuilt('Evidence source'),
      neighbourhood: () => unbuilt('Evidence source'),
    },
    cases: {
      open: () => unbuilt('Case repository'),
      findById: () => unbuilt('Case repository'),
      changeStatus: () => unbuilt('Case repository'),
      attachSummary: () => unbuilt('Case repository'),
    },
    explanations: { find: () => unbuilt('Explanation cache'), store: () => unbuilt('Explanation cache') },
  };
}
