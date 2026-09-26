import { DEMO_TAKEOVER_01 } from '@sentinel/domain';
import type { ScenarioEventFactory } from '../catalogue/scenario-event-factory.js';
import type { SyntheticAccount } from '../catalogue/synthetic-roster.js';
import type { ScenarioStep } from '../scenario.js';
import type { ScenarioGenerator } from './scenario-generator.js';

export interface TakeoverInput {
  readonly events: ScenarioEventFactory;
  readonly victim: SyntheticAccount;
}

const PRIOR_ACTIVITY_HOURS_AGO = 6;

/**
 * The phishing-driven takeover of DEMO_TAKEOVER_01: prior legitimate activity inside the window, a login from
 * an unseen device, new payees, then four transfers. Before each transfer the bank reports the account's
 * velocity ratio, the explicit input the HTML reference uses.
 */
export const takeoverGenerator: ScenarioGenerator<TakeoverInput, readonly ScenarioStep[]> = {
  name: 'takeover',
  generate(_random, { events, victim }) {
    const prior = events.transfer({
      source: victim,
      payeeId: 'PAYEE-1104',
      destinationInstitutionId: victim.institutionId,
      amount: DEMO_TAKEOVER_01.priorOutflowInWindow,
      deviceId: events.homeDevice(victim),
      occurredAt: events.hoursBefore(PRIOR_ACTIVITY_HOURS_AGO),
    });
    const steps: ScenarioStep[] = [{ atMs: 0, action: 'TRANSFER', ...prior }];

    for (const step of DEMO_TAKEOVER_01.steps) {
      const occurredAt = events.at(step.atMs);
      switch (step.action) {
        case 'LOGIN_NEW_DEVICE':
          steps.push({
            atMs: step.atMs,
            action: 'LOGIN_NEW_DEVICE',
            event: events.securityEvent(victim, 'NEW_DEVICE', occurredAt, { deviceId: DEMO_TAKEOVER_01.newDeviceId }),
          });
          break;
        case 'ADD_PAYEE':
          steps.push({
            atMs: step.atMs,
            action: 'ADD_PAYEE',
            event: events.securityEvent(victim, 'PAYEE_ADDED', occurredAt, { payeeId: step.payeeId }),
          });
          break;
        case 'TRANSFER':
          steps.push({
            atMs: step.atMs,
            action: 'REPORT_ACCOUNT',
            report: events.accountReport(victim, DEMO_TAKEOVER_01.openingBalance, step.velocityRatio, occurredAt),
          });
          steps.push({
            atMs: step.atMs,
            action: 'TRANSFER',
            ...events.transfer({
              source: victim,
              payeeId: step.payeeId,
              destinationInstitutionId: step.destinationInstitutionId,
              amount: step.amount,
              deviceId: DEMO_TAKEOVER_01.newDeviceId,
              occurredAt,
            }),
          });
          break;
      }
    }
    return steps;
  },
};
