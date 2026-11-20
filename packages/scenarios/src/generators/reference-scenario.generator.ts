import {
  REFERENCE_SCENARIOS,
  scaleReferenceAmount,
  type AccountSecurityEventType,
  type InstitutionId,
  type MultiScamBurstCaseSpec,
  type ReferenceDestination,
} from '@sentinel/domain';
import type { ScenarioEventFactory } from '../catalogue/scenario-event-factory.js';
import type { SyntheticAccount } from '../catalogue/synthetic-roster.js';
import type { ScenarioStep } from '../scenario.js';
import { muleNetworkGenerator } from './mule-network.generator.js';
import type { ScenarioGenerator } from './scenario-generator.js';

export interface ReferenceScenarioInput {
  readonly events: ScenarioEventFactory;
  readonly account: SyntheticAccount;
  readonly spec: MultiScamBurstCaseSpec;
  /** The reference's `cross` option: o1 and o2 are the other two banks instead of the account's own. */
  readonly cross: boolean;
}

const INSTITUTIONS: readonly InstitutionId[] = ['BANK_A', 'BANK_B', 'BANK_C'];
const PRIOR_ACTIVITY_HOURS_AGO = 6;
const PRIOR_PAYEE = 'PAYEE-1104';

const STEP_ACTION: Partial<Record<AccountSecurityEventType, 'LOGIN_NEW_DEVICE' | 'ADD_PAYEE'>> = {
  NEW_DEVICE: 'LOGIN_NEW_DEVICE',
  PAYEE_ADDED: 'ADD_PAYEE',
};

/**
 * One case of the HTML reference's buildScenario (phishing, mule, smurf or replay) on one synthetic account,
 * timed from the case's start. Amounts are scaled exactly as the reference scales them; the account's prior
 * activity inside the window is one transfer to an established payee, as in the takeover generator. Before each
 * transfer the bank reports the account's velocity ratio, the explicit input the reference uses.
 */
export const referenceScenarioGenerator: ScenarioGenerator<ReferenceScenarioInput, readonly ScenarioStep[]> = {
  name: 'reference-scenario',
  generate(random, { events, account, spec, cross }) {
    const scenario = REFERENCE_SCENARIOS[spec.scenario];
    const others = INSTITUTIONS.filter((institution) => institution !== account.institutionId);
    const destination = (slot: ReferenceDestination): InstitutionId =>
      slot === 'own' || !cross ? account.institutionId : (slot === 'o1' ? others[0] : others[1]) ?? account.institutionId;
    const scaled = (amount: number) => scaleReferenceAmount(amount, scenario.role, spec.balance);

    const steps: ScenarioStep[] = [
      { atMs: spec.startMs, action: 'REPORT_ACCOUNT', report: events.accountReport(account, spec.balance, 1, events.at(spec.startMs)) },
    ];
    for (const step of scenario.steps) {
      if (step.kind !== 'transfer' || !step.flaggedLinks) continue;
      steps.push({
        atMs: spec.startMs,
        action: 'OBSERVE_NETWORK',
        observation: muleNetworkGenerator.generate(random, {
          destinationPayeeId: step.payeeId,
          destinationInstitutionId: destination(step.destination),
          flaggedLinks: step.flaggedLinks,
          observedAt: events.hoursBefore(2),
          token: (prefix, identifier) => events.token(prefix, identifier),
        }),
      });
    }
    const prior = events.transfer({
      source: account,
      payeeId: PRIOR_PAYEE,
      destinationInstitutionId: account.institutionId,
      amount: scaled(scenario.priorOutflow),
      deviceId: events.homeDevice(account),
      occurredAt: events.hoursBefore(PRIOR_ACTIVITY_HOURS_AGO),
    });
    steps.push({ atMs: spec.startMs, action: 'TRANSFER', ...prior });

    let atMs = spec.startMs;
    for (const step of scenario.steps) {
      atMs += step.gapMs;
      const occurredAt = events.at(atMs);
      switch (step.kind) {
        case 'inbound':
          // The reference only logs the credit; the bank re-reports the account, whose window-start balance is unchanged.
          steps.push({ atMs, action: 'REPORT_ACCOUNT', report: events.accountReport(account, spec.balance, 1, occurredAt) });
          break;
        case 'security':
          steps.push({
            atMs,
            action: STEP_ACTION[step.eventType] ?? 'SECURITY_EVENT',
            event: events.securityEvent(
              account,
              step.eventType,
              step.hoursBefore === undefined ? occurredAt : events.hoursBefore(step.hoursBefore),
              { ...(step.deviceId ? { deviceId: step.deviceId } : {}), ...(step.payeeId ? { payeeId: step.payeeId } : {}) },
            ),
          });
          break;
        case 'transfer':
          steps.push({ atMs, action: 'REPORT_ACCOUNT', report: events.accountReport(account, spec.balance, step.velocityRatio, occurredAt) });
          steps.push({
            atMs,
            action: 'TRANSFER',
            ...events.transfer({
              source: account,
              payeeId: step.payeeId,
              destinationInstitutionId: destination(step.destination),
              amount: scaled(step.amount),
              deviceId: step.device === 'home' ? events.homeDevice(account) : step.device,
              occurredAt,
            }),
          });
          break;
      }
    }
    return steps;
  },
};
