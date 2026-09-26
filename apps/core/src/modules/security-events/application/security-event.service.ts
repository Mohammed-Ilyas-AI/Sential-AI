import type { AccountSecurityEvent, SecurityEventReceipt } from '@sentinel/domain';
import { assessPosture, type RiskRule } from '@sentinel/rules';
import { ApplicationError } from '../../../platform/errors/application-error.js';
import type { ComputeRollingWindow } from '../../accounts/application/compute-rolling-window.use-case.js';
import type { AccountRepository } from '../../accounts/application/ports/account-repository.port.js';
import type { AccountSecurityStateRepository } from '../../accounts/application/ports/account-security-state-repository.port.js';
import type { PolicyConfiguration } from '../../policy/application/ports/policy-configuration.port.js';
import type { SecurityEventLog } from './ports/security-event-log.port.js';
import type { RecordAccountSecurityEvent } from './record-account-security-event.use-case.js';
import { applySecurityEvent, emptySecurityState } from './security-state-transitions.js';

export interface SecurityEventServiceDependencies {
  readonly events: SecurityEventLog;
  readonly accounts: AccountRepository;
  readonly securityStates: AccountSecurityStateRepository;
  readonly rollingWindow: ComputeRollingWindow;
  readonly policy: PolicyConfiguration;
  readonly rules: readonly RiskRule[];
}

/** Records the event once, updates security state, and reports the account's posture with no transfer in flight. */
export class SecurityEventService implements RecordAccountSecurityEvent {
  constructor(private readonly dependencies: SecurityEventServiceDependencies) {}

  async record(event: AccountSecurityEvent): Promise<SecurityEventReceipt> {
    const deps = this.dependencies;
    const account = await deps.accounts.findAccount(event.accountToken);
    if (!account) {
      throw new ApplicationError('UNPROCESSABLE', `Account ${event.accountToken} is unknown; the bank must report it first`);
    }

    const logged = await deps.events.append(event);
    let state = (await deps.securityStates.findSecurityState(account.id)) ?? emptySecurityState(account.id);
    if (logged.outcome === 'CREATED') {
      state = applySecurityEvent(state, event);
      await deps.securityStates.saveSecurityState(state);
    }

    const window = await deps.rollingWindow.windowFor(account, event.occurredAt);
    const posture = assessPosture({
      account,
      securityState: state,
      window,
      policy: deps.policy.rapidDrainPolicy(),
      evaluatedAt: event.occurredAt,
      rules: deps.rules,
    });
    return { eventId: event.eventId, outcome: logged.outcome === 'CREATED' ? 'RECORDED' : 'DUPLICATE', posture };
  }
}
