import type {
  AccountProfile,
  AlertSummary,
  DeviceEvent,
  GraphHopDepth,
  GraphNeighbourhood,
  Intervention,
  PayeeEvent,
  RecordedRiskAssessment,
  RiskExplanation,
  Transaction,
} from '@sentinel/domain';
import type { ExplanationCache } from '../../../src/modules/intelligence/application/ports/explanation-cache.port.js';
import type { EvidenceSource } from '../../../src/modules/investigations/application/ports/evidence-source.port.js';
import type { InMemoryAccountStateRepository } from './in-memory-account-state.repository.js';
import type { InMemoryGraphStore } from './in-memory-graph.store.js';
import type { InMemoryInterventionRepository } from './in-memory-intervention.repository.js';
import type { InMemoryAlertRepository, InMemoryAssessmentRepository, InMemorySecurityEventLog } from './in-memory-simple-stores.js';
import type { InMemoryTransactionStore } from './in-memory-transaction-store.js';

export interface InMemoryEvidenceStores {
  readonly accounts: InMemoryAccountStateRepository;
  readonly assessments: InMemoryAssessmentRepository;
  readonly transactions: InMemoryTransactionStore;
  readonly securityEvents: InMemorySecurityEventLog;
  readonly alerts: InMemoryAlertRepository;
  readonly interventions: InMemoryInterventionRepository;
  readonly graph: InMemoryGraphStore;
}

/** The same reads as MongoEvidenceSource, over the in-memory stores the control path wrote. */
export class InMemoryEvidenceSource implements EvidenceSource {
  constructor(private readonly stores: InMemoryEvidenceStores) {}

  async accountProfile(accountId: string): Promise<AccountProfile | null> {
    const account = await this.stores.accounts.findAccount(accountId);
    if (!account) return null;
    return {
      accountId: account.id,
      institutionId: account.institutionId,
      openedAt: account.openedAt,
      protected: account.protected,
      ...(account.coolingOffUntil ? { coolingOffUntil: account.coolingOffUntil } : {}),
    };
  }

  assessment(assessmentId: string): Promise<RecordedRiskAssessment | null> {
    return this.stores.assessments.findById(assessmentId);
  }

  async recentTransactions(accountId: string, limit: number): Promise<readonly Transaction[]> {
    return this.stores.transactions
      .allProjections()
      .filter((projection) => projection.sourceAccountId === accountId)
      .sort((left, right) => right.ts.localeCompare(left.ts))
      .slice(0, limit)
      .map(({ status, effectiveAmount, accountSequence, drainExcluded, ...transaction }) => transaction);
  }

  async deviceHistory(accountId: string): Promise<readonly DeviceEvent[]> {
    return this.stores.securityEvents
      .all()
      .filter((event) => event.accountToken === accountId && (event.eventType === 'NEW_DEVICE' || event.eventType === 'TOKEN_ACTIVATED'))
      .flatMap((event) => (event.deviceToken ? [{ deviceId: event.deviceToken, eventType: event.eventType, occurredAt: event.occurredAt }] : []));
  }

  async payeeHistory(accountId: string): Promise<readonly PayeeEvent[]> {
    return this.stores.securityEvents
      .all()
      .filter((event) => event.accountToken === accountId && event.eventType === 'PAYEE_ADDED')
      .flatMap((event): PayeeEvent[] => (event.beneficiaryToken ? [{ payeeId: event.beneficiaryToken, eventType: 'PAYEE_ADDED', occurredAt: event.occurredAt }] : []));
  }

  async priorAlerts(accountId: string): Promise<readonly AlertSummary[]> {
    return this.stores.alerts
      .all()
      .filter((alert) => alert.accountId === accountId)
      .map((alert) => ({ alertId: alert.id, score: alert.score, band: alert.band, raisedAt: alert.raisedAt }));
  }

  interventions(accountId: string): Promise<readonly Intervention[]> {
    return this.stores.interventions.findByAccountId(accountId);
  }

  async neighbourhood(rootId: string, hopDepth: GraphHopDepth): Promise<GraphNeighbourhood> {
    const { nodes, edges } = this.stores.graph.snapshot();
    const reached = new Set([rootId]);
    for (let hop = 0; hop < hopDepth; hop += 1) {
      for (const edge of edges) if (reached.has(edge.from) || reached.has(edge.to)) [edge.from, edge.to].forEach((id) => reached.add(id));
    }
    return {
      rootId,
      hopDepth,
      nodes: nodes.filter((node) => reached.has(node.id)),
      edges: edges.filter((edge) => reached.has(edge.from) && reached.has(edge.to)),
      truncated: false,
    };
  }
}

export class InMemoryExplanationCache implements ExplanationCache {
  private readonly explanations = new Map<string, RiskExplanation>();

  async find(assessmentId: string): Promise<RiskExplanation | null> {
    return this.explanations.get(assessmentId) ?? null;
  }

  async store(explanation: RiskExplanation): Promise<void> {
    if (!this.explanations.has(explanation.assessmentId)) this.explanations.set(explanation.assessmentId, explanation);
  }
}
