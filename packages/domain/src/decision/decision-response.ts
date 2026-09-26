import type { PolicyCode } from '../policy/policy-codes.js';
import type { TenantId } from '../tenant/tenant-identifiers.js';
import type { IsoTimestamp } from '../time/iso-timestamp.js';
import type { Decision } from './decision.js';

/** Reproducible months later. A retry with the same idempotencyKey returns this same record. */
export interface DecisionResponse {
  readonly decisionId: string;
  readonly tenantId: TenantId;
  readonly transactionId: string;
  readonly idempotencyKey: string;
  readonly decision: Decision;
  /** Advisory; the gate, not the score, decides. */
  readonly riskScore: number;
  readonly policyCodes: readonly PolicyCode[];
  readonly reasonCodes: readonly string[];
  readonly assessmentId: string;
  readonly rulesetVersion: string;
  readonly policyVersion: string;
  readonly caseId?: string;
  /** Auto-release time for HOLD. */
  readonly holdUntil?: IsoTimestamp;
  readonly decidedAt: IsoTimestamp;
  /** After this the bank must ask again. */
  readonly expiresAt: IsoTimestamp;
  /** Joins logs, events and audit. */
  readonly traceId: string;
}
