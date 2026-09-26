import type { DecisionRequest, DecisionResponse } from '@sentinel/domain';
import type { TraceId } from '../../../platform/correlation/trace-id.js';

/** POST /v1/decision/transactions: ALLOW, HOLD or REJECT before the transfer commits. */
export interface DecideTransaction {
  decide(request: DecisionRequest, traceId: TraceId): Promise<DecisionResponse>;
}
