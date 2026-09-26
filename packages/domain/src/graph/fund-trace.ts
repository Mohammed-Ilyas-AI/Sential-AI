import type { InstitutionId } from '../tenant/tenant-identifiers.js';
import type { GraphEdge } from './graph-edge.js';

/** A trace never implies a complete path; it states where observation stops. We never invent a hop. */
export interface TraceObservability {
  readonly complete: boolean;
  readonly boundary?: InstitutionId;
}

export interface FundTrace {
  readonly rootId: string;
  readonly hops: readonly GraphEdge[];
  readonly observability: TraceObservability;
}
