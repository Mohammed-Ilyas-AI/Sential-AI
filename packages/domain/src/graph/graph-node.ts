import type { InstitutionId } from '../tenant/tenant-identifiers.js';

export type NodeKind = 'ACCOUNT' | 'PAYEE' | 'DEVICE' | 'INSTITUTION';

export interface GraphNode {
  readonly id: string;
  readonly kind: NodeKind;
  readonly institutionId?: InstitutionId;
  readonly flagged: boolean;
  /** For example RAPID_MOVEMENT or MULTI_BENEFICIARY. */
  readonly riskIndicators: readonly string[];
  readonly txCount: number;
}
