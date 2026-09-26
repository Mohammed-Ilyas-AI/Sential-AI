import type { DecisionRequest, DecisionResponse } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';

/** The bank's pre-transaction call: ask before the transfer commits. */
export interface DecisionApi {
  decide(request: DecisionRequest): Promise<DecisionResponse>;
}

/** POST {coreBaseUrl}/v1/decision/transactions. Retries reuse the idempotencyKey and receive the stored decision. */
export class HttpDecisionApiClient implements DecisionApi {
  constructor(private readonly coreBaseUrl: string) {}

  decide(): Promise<DecisionResponse> {
    throw new NotYetImplementedError('Decision API client', 'scheduled for build order step 2');
  }
}
