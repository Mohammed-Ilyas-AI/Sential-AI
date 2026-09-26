import type { AccountSecurityEvent } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';

export interface SecurityEventApi {
  record(event: AccountSecurityEvent): Promise<void>;
}

/** POST {coreBaseUrl}/v1/events/security, synchronously, so a new device is known before the next transfer. */
export class HttpSecurityEventApiClient implements SecurityEventApi {
  constructor(private readonly coreBaseUrl: string) {}

  record(): Promise<void> {
    throw new NotYetImplementedError('Security event client', 'scheduled for build order step 2');
  }
}
