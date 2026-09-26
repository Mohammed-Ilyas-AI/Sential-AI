import { InMemoryAccountStateRepository } from '../support/in-memory-repositories/in-memory-account-state.repository.js';
import { InMemoryDecisionRepository } from '../support/in-memory-repositories/in-memory-decision.repository.js';
import { InMemoryGraphStore } from '../support/in-memory-repositories/in-memory-graph.store.js';
import { InMemoryInterventionRepository } from '../support/in-memory-repositories/in-memory-intervention.repository.js';
import {
  InMemoryAlertRepository,
  InMemoryAssessmentRepository,
  InMemorySecurityEventLog,
} from '../support/in-memory-repositories/in-memory-simple-stores.js';
import { InMemoryTransactionStore } from '../support/in-memory-repositories/in-memory-transaction-store.js';
import { describeAccountStateContract } from './account-state.contract.js';
import { describeDecisionRepositoryContract } from './decision-repository.contract.js';
import { describeInterventionRepositoryContract } from './intervention-repository.contract.js';
import { describeNetworkGraphContract } from './network-graph.contract.js';
import { describeRecordStoresContract } from './record-stores.contract.js';
import { describeTransactionStoreContract } from './transaction-store.contract.js';

describeDecisionRepositoryContract('in-memory', () => new InMemoryDecisionRepository());
describeInterventionRepositoryContract('in-memory', () => new InMemoryInterventionRepository());
describeTransactionStoreContract('in-memory', () => {
  const store = new InMemoryTransactionStore();
  return { events: store, projections: store, outflows: store };
});
describeAccountStateContract('in-memory', () => new InMemoryAccountStateRepository());
describeRecordStoresContract('in-memory', () => ({
  assessments: new InMemoryAssessmentRepository(),
  alerts: new InMemoryAlertRepository(),
  securityEvents: new InMemorySecurityEventLog(),
}));
describeNetworkGraphContract('in-memory', () => {
  const graph = new InMemoryGraphStore();
  return { graph, entityLinks: graph };
});
