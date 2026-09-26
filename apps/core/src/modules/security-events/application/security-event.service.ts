import { NotYetImplementedError } from '@sentinel/domain';
import type { AccountStateRepository } from '../../accounts/application/ports/account-state-repository.port.js';
import type { SecurityEventLog } from './ports/security-event-log.port.js';
import type { RecordAccountSecurityEvent } from './record-account-security-event.use-case.js';

export class SecurityEventService implements RecordAccountSecurityEvent {
  constructor(
    private readonly events: SecurityEventLog,
    private readonly accountStates: AccountStateRepository,
  ) {}

  record(): Promise<void> {
    throw new NotYetImplementedError('Account security event', 'scheduled with the rule engine (build order step 6)');
  }
}
