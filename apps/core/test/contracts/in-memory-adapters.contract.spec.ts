import { InMemoryDecisionRepository } from '../support/in-memory-repositories/in-memory-decision.repository.js';
import { InMemoryInterventionRepository } from '../support/in-memory-repositories/in-memory-intervention.repository.js';
import { describeDecisionRepositoryContract } from './decision-repository.contract.js';
import { describeInterventionRepositoryContract } from './intervention-repository.contract.js';

describeDecisionRepositoryContract('in-memory', () => new InMemoryDecisionRepository());
describeInterventionRepositoryContract('in-memory', () => new InMemoryInterventionRepository());
