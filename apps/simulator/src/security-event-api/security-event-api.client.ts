import type { AccountSecurityEvent, SecurityEventReceipt } from '@sentinel/domain';
import type { CoreHttpClient } from '../decision-api/core-http.client.js';

export interface SecurityEventApi {
  record(event: AccountSecurityEvent): Promise<SecurityEventReceipt>;
}

/** POST /v1/events/security, synchronously, so a new device is known before the next transfer. */
export class HttpSecurityEventApiClient implements SecurityEventApi {
  constructor(private readonly core: CoreHttpClient) {}

  record(event: AccountSecurityEvent): Promise<SecurityEventReceipt> {
    return this.core.send<SecurityEventReceipt>('POST', '/v1/events/security', event);
  }
}
