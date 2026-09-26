import { accountsCollection } from './accounts.collection.js';
import { alertsCollection } from './alerts.collection.js';
import { assessmentsCollection } from './assessments.collection.js';
import { casesCollection } from './cases.collection.js';
import type { CollectionDefinition } from './collection-definition.js';
import { decisionsCollection } from './decisions.collection.js';
import { entitiesCollection } from './entities.collection.js';
import { entityEdgesCollection } from './entity-edges.collection.js';
import { interventionsCollection } from './interventions.collection.js';
import { securityEventsCollection } from './security-events.collection.js';
import { transactionEventsCollection } from './transaction-events.collection.js';
import { transactionsCollection } from './transactions.collection.js';

/** The eleven v1.2 collections. MongoDB Atlas is the only operational store. */
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
];
