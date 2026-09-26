import type { DecisionResponse, SecurityEventReceipt } from '@sentinel/domain';
import type { Scenario, ScenarioStep } from '../scenario.js';
import type { BankConnector, ScenarioTimeline } from './bank-connector.js';

export interface PlayedTransfer {
  readonly step: Extract<ScenarioStep, { action: 'TRANSFER' }>;
  readonly response: DecisionResponse;
}

export interface PlaybackReport {
  readonly transfers: readonly PlayedTransfer[];
  readonly securityReceipts: readonly SecurityEventReceipt[];
}

/**
 * Plays the bank's side in order: account reports and network observations, security events, then for every
 * transfer ask for a decision before committing and only afterwards publish the lifecycle. HOLD is never settled.
 */
export async function playScenario(
  scenario: Scenario,
  bank: BankConnector,
  timeline: ScenarioTimeline,
  onStep?: (step: ScenarioStep) => void,
): Promise<PlaybackReport> {
  const transfers: PlayedTransfer[] = [];
  const securityReceipts: SecurityEventReceipt[] = [];

  for (const step of scenario.timeline) {
    await timeline.waitUntil(step.atMs);
    onStep?.(step);
    switch (step.action) {
      case 'REPORT_ACCOUNT':
        await bank.reportAccount(step.report);
        break;
      case 'OBSERVE_NETWORK':
        await bank.observeNetwork(step.observation);
        break;
      case 'LOGIN_NEW_DEVICE':
      case 'ADD_PAYEE':
      case 'SECURITY_EVENT':
        securityReceipts.push(await bank.recordSecurityEvent(step.event));
        break;
      case 'TRANSFER': {
        const response = await bank.requestDecision(step.request);
        transfers.push({ step, response });
        if (response.decision === 'ALLOW') {
          for (const event of step.lifecycleOnAllow) await bank.publishLifecycleEvent(event);
        }
        break;
      }
      case 'NOOP':
        break;
    }
  }
  return { transfers, securityReceipts };
}
