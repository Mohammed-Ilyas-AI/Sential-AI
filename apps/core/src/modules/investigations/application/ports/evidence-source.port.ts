import type {
  AccountProfile,
  AlertSummary,
  DeviceEvent,
  GraphHopDepth,
  GraphNeighbourhood,
  Intervention,
  PayeeEvent,
  RecordedRiskAssessment,
  Transaction,
} from '@sentinel/domain';

/** Read-only access to everything an evidence bundle may contain, each read already capped. */
export interface EvidenceSource {
  accountProfile(accountId: string): Promise<AccountProfile | null>;
  assessment(assessmentId: string): Promise<RecordedRiskAssessment | null>;
  recentTransactions(accountId: string, limit: number): Promise<readonly Transaction[]>;
  deviceHistory(accountId: string): Promise<readonly DeviceEvent[]>;
  payeeHistory(accountId: string): Promise<readonly PayeeEvent[]>;
  priorAlerts(accountId: string): Promise<readonly AlertSummary[]>;
  interventions(accountId: string): Promise<readonly Intervention[]>;
  neighbourhood(rootId: string, hopDepth: GraphHopDepth): Promise<GraphNeighbourhood>;
}
