import {
  GRAPH_EDGE_CAP,
  GRAPH_NODE_CAP,
  type AccountProfile,
  type AccountSecurityEventType,
  type AlertSummary,
  type DeviceEvent,
  type GraphEdge,
  type GraphHopDepth,
  type GraphNeighbourhood,
  type Intervention,
  type PayeeEvent,
  type RecordedRiskAssessment,
  type Transaction,
} from '@sentinel/domain';
import type { Collection } from 'mongodb';
import type { EvidenceSource } from '../../../../modules/investigations/application/ports/evidence-source.port.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import { accountsCollection, type AccountDocument } from '../collections/accounts.collection.js';
import { alertsCollection, type AlertDocument } from '../collections/alerts.collection.js';
import { assessmentsCollection, type AssessmentDocument } from '../collections/assessments.collection.js';
import { entitiesCollection, type EntityDocument } from '../collections/entities.collection.js';
import { edgeIdentity, entityEdgesCollection, type EntityEdgeDocument } from '../collections/entity-edges.collection.js';
import { interventionsCollection, type InterventionDocument } from '../collections/interventions.collection.js';
import { securityEventsCollection, type SecurityEventDocument } from '../collections/security-events.collection.js';
import { transactionsCollection, type TransactionProjectionDocument } from '../collections/transactions.collection.js';
import { fromAssessmentDocument } from '../serializers/assessment.serializer.js';
import { withoutStorageFields } from '../serializers/document-identity.js';

const SECURITY_HISTORY_LIMIT = 20;
const PRIOR_ALERTS_LIMIT = 10;
const DEVICE_EVENTS: readonly AccountSecurityEventType[] = ['NEW_DEVICE', 'TOKEN_ACTIVATED'];

/** One capped read per evidence section; the document shape is why MongoDB suits this bundle. Read-only. */
export class MongoEvidenceSource implements EvidenceSource {
  private readonly accounts: Collection<AccountDocument>;
  private readonly assessments: Collection<AssessmentDocument>;
  private readonly transactions: Collection<TransactionProjectionDocument>;
  private readonly securityEvents: Collection<SecurityEventDocument>;
  private readonly alerts: Collection<AlertDocument>;
  private readonly interventionLog: Collection<InterventionDocument>;
  private readonly entities: Collection<EntityDocument>;
  private readonly edges: Collection<EntityEdgeDocument>;

  constructor(database: MongoDatabase) {
    this.accounts = database.collection<AccountDocument>(accountsCollection.name);
    this.assessments = database.collection<AssessmentDocument>(assessmentsCollection.name);
    this.transactions = database.collection<TransactionProjectionDocument>(transactionsCollection.name);
    this.securityEvents = database.collection<SecurityEventDocument>(securityEventsCollection.name);
    this.alerts = database.collection<AlertDocument>(alertsCollection.name);
    this.interventionLog = database.collection<InterventionDocument>(interventionsCollection.name);
    this.entities = database.collection<EntityDocument>(entitiesCollection.name);
    this.edges = database.collection<EntityEdgeDocument>(entityEdgesCollection.name);
  }

  /** Synthetic identifiers and flags only: no display reference, no balance, no behaviour profile. */
  async accountProfile(accountId: string): Promise<AccountProfile | null> {
    const document = await this.accounts.findOne({ _id: accountId });
    if (!document) return null;
    const coolingOffUntil = document.securityState?.coolingOffUntil ?? document.coolingOffUntil;
    return {
      accountId: document._id,
      institutionId: document.institutionId,
      openedAt: document.openedAt,
      protected: document.protected,
      ...(coolingOffUntil ? { coolingOffUntil } : {}),
    };
  }

  async assessment(assessmentId: string): Promise<RecordedRiskAssessment | null> {
    const document = await this.assessments.findOne({ _id: assessmentId });
    return document ? fromAssessmentDocument(document) : null;
  }

  async recentTransactions(accountId: string, limit: number): Promise<readonly Transaction[]> {
    const documents = await this.transactions.find({ sourceAccountId: accountId }).sort({ ts: -1 }).limit(limit).toArray();
    return documents.map(({ _id, status, effectiveAmount, accountSequence, drainExcluded, ...transaction }) => transaction);
  }

  async deviceHistory(accountId: string): Promise<readonly DeviceEvent[]> {
    const documents = await this.securityEvents
      .find({ accountToken: accountId, eventType: { $in: DEVICE_EVENTS } })
      .sort({ occurredAt: -1 })
      .limit(SECURITY_HISTORY_LIMIT)
      .toArray();
    return documents.flatMap((event) => (event.deviceToken ? [{ deviceId: event.deviceToken, eventType: event.eventType, occurredAt: event.occurredAt }] : []));
  }

  async payeeHistory(accountId: string): Promise<readonly PayeeEvent[]> {
    const documents = await this.securityEvents
      .find({ accountToken: accountId, eventType: 'PAYEE_ADDED' })
      .sort({ occurredAt: -1 })
      .limit(SECURITY_HISTORY_LIMIT)
      .toArray();
    return documents.flatMap((event): PayeeEvent[] =>
      event.beneficiaryToken ? [{ payeeId: event.beneficiaryToken, eventType: 'PAYEE_ADDED', occurredAt: event.occurredAt }] : [],
    );
  }

  async priorAlerts(accountId: string): Promise<readonly AlertSummary[]> {
    const documents = await this.alerts.find({ accountId }).sort({ raisedAt: -1 }).limit(PRIOR_ALERTS_LIMIT).toArray();
    return documents.map((alert) => ({ alertId: alert.id, score: alert.score, band: alert.band, raisedAt: alert.raisedAt }));
  }

  async interventions(accountId: string): Promise<readonly Intervention[]> {
    const documents = await this.interventionLog.find({ accountId }).sort({ actedAt: 1, ordinal: 1 }).toArray();
    return documents.map(withoutStorageFields);
  }

  /** Breadth-first over entity_edges, heaviest edges first, stopping at the node and edge caps. */
  async neighbourhood(rootId: string, hopDepth: GraphHopDepth): Promise<GraphNeighbourhood> {
    const reached = new Set([rootId]);
    const edges = new Map<string, GraphEdge>();
    let frontier = [rootId];
    let truncated = false;
    for (let hop = 0; hop < hopDepth && frontier.length > 0; hop += 1) {
      const found = await this.edges
        .find({ $or: [{ from: { $in: frontier } }, { to: { $in: frontier } }] })
        .sort({ weight: -1 })
        .limit(GRAPH_EDGE_CAP + 1)
        .toArray();
      const next: string[] = [];
      for (const document of found) {
        const edge = withoutStorageFields(document);
        for (const id of [edge.from, edge.to]) {
          if (reached.has(id)) continue;
          if (reached.size >= GRAPH_NODE_CAP) {
            truncated = true;
            continue;
          }
          reached.add(id);
          next.push(id);
        }
        if (!reached.has(edge.from) || !reached.has(edge.to)) continue;
        if (edges.size < GRAPH_EDGE_CAP) edges.set(edgeIdentity(edge), edge);
        else truncated = true;
      }
      frontier = next;
    }
    const nodes = (await this.entities.find({ _id: { $in: [...reached] } }).toArray()).map(withoutStorageFields);
    return { rootId, hopDepth, nodes, edges: [...edges.values()], truncated };
  }
}
