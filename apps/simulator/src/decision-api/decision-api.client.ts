import type { DecisionRequest, DecisionResponse } from '@sentinel/domain';
import type { CoreHttpClient } from './core-http.client.js';

/** The bank's pre-transaction call: ask before the transfer commits. */
export interface DecisionApi {
  decide(request: DecisionRequest): Promise<DecisionResponse>;
}

/** POST /v1/decision/transactions. A retry reuses the idempotencyKey and receives the stored decision. */
export class HttpDecisionApiClient implements DecisionApi {
  constructor(private readonly core: CoreHttpClient) {}

  decide(request: DecisionRequest): Promise<DecisionResponse> {
    return this.core.send<DecisionResponse>('POST', '/v1/decision/transactions', request);
  }
}
