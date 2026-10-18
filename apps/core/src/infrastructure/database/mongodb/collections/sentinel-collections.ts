import { accountsCollection } from './accounts.collection.js';
import { alertsCollection } from './alerts.collection.js';
import { assessmentsCollection } from './assessments.collection.js';
import { casesCollection } from './cases.collection.js';
import type { CollectionDefinition } from './collection-definition.js';
import { decisionsCollection } from './decisions.collection.js';
import { entitiesCollection } from './entities.collection.js';
import { entityEdgesCollection } from './entity-edges.collection.js';
import { interventionsCollection } from './interventions.collection.js';
import {
  accountControlsCollection,
  auditEventsCollection,
  caseReportsCollection,
  caseSummariesCollection,
  customerContactsCollection,
  scenarioRunsCollection,
} from './operations.collections.js';
import { securityEventsCollection } from './security-events.collection.js';
import { transactionEventsCollection } from './transaction-events.collection.js';
import { transactionsCollection } from './transactions.collection.js';

/**
 * The eleven v1.2 collections, then the operational records added to close the readiness gaps: the audit
 * events, kill-switch history, customer contacts, case report versions, archived summaries and scenario runs.
 * MongoDB Atlas is the only operational store.
 */
export const SENTINEL_COLLECTIONS: readonly CollectionDefinition[] = [
  accountsCollection,
  transactionEventsCollection,
  transactionsCollection,
  securityEventsCollection,
  decisionsCollection,
  assessmentsCollection,
  interventionsCollection,
  alertsCollection,
  casesCollection,
  entitiesCollection,
  entityEdgesCollection,
  auditEventsCollection,
  accountControlsCollection,
  customerContactsCollection,
  caseReportsCollection,
  caseSummariesCollection,
  scenarioRunsCollection,
];
