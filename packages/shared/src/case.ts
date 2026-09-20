import type { PolicyDecision } from './policy.js';
import type { RiskAssessment, RiskBand } from './risk.js';
import type { Transaction } from './transaction.js';

export type CaseStatus = 'open' | 'investigating' | 'resolved_fraud' | 'resolved_legitimate';

export type EntityKind = 'account' | 'device' | 'payee';

export interface GraphNode {
  readonly id: string;
  readonly kind: EntityKind;
  readonly label: string;
}

export interface GraphEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: 'transacted_with' | 'shares_device' | 'shares_payee';
}

export interface EntityGraph {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

export interface AuditEntry {
  readonly at: string;
  readonly actor: string;
  readonly action: string;
  readonly detail: string;
}

export interface Case {
  readonly id: string;
  readonly status: CaseStatus;
  readonly band: RiskBand;
  readonly transactions: readonly Transaction[];
  readonly assessments: readonly RiskAssessment[];
  readonly decisions: readonly PolicyDecision[];
  readonly graph: EntityGraph | null;
  readonly audit: readonly AuditEntry[];
  readonly openedAt: string;
}
