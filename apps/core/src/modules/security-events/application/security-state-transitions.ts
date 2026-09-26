import { COOLING_OFF_HOURS, type AccountSecurityEvent, type AccountSecurityEventType, type AccountState } from '@sentinel/domain';
import { addHours } from '@sentinel/rules';

/** High-risk account events that start the 12-hour cooling-off (M§3, HTML reference). */
const COOLING_OFF_EVENTS: ReadonlySet<AccountSecurityEventType> = new Set([
  'TOKEN_ACTIVATED',
  'PASSWORD_CHANGED',
  'MOBILE_NUMBER_CHANGED',
]);

export function emptySecurityState(accountId: string): AccountState {
  return { accountId, deviceFirstSeenAt: {}, payeeFirstSeenAt: {} };
}

/** A pure transition: the first sighting of a device or payee is kept; cooling-off only ever extends. */
export function applySecurityEvent(state: AccountState, event: AccountSecurityEvent): AccountState {
  let next: AccountState = state;

  if ((event.eventType === 'NEW_DEVICE' || event.eventType === 'TOKEN_ACTIVATED') && event.deviceToken) {
    next = {
      ...next,
      newDeviceAt: event.occurredAt,
      deviceFirstSeenAt: { [event.deviceToken]: event.occurredAt, ...next.deviceFirstSeenAt },
    };
  }

  if (event.eventType === 'PAYEE_ADDED' && event.beneficiaryToken) {
    next = { ...next, payeeFirstSeenAt: { [event.beneficiaryToken]: event.occurredAt, ...next.payeeFirstSeenAt } };
  }

  if (COOLING_OFF_EVENTS.has(event.eventType)) {
    const until = addHours(event.occurredAt, COOLING_OFF_HOURS);
    if (!next.coolingOffUntil || Date.parse(until) > Date.parse(next.coolingOffUntil)) next = { ...next, coolingOffUntil: until };
  }
  return next;
}
