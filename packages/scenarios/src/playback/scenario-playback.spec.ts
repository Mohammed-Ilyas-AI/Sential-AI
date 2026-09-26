import type { DecisionRequest, DecisionResponse, SecurityEventReceipt } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import { buildDemoTakeover01 } from '../demo/demo-takeover-01.js';
import { INSTANT_TIMELINE, type BankConnector } from './bank-connector.js';
import { playScenario } from './scenario-playback.js';

function recordingBank(decideAs: (request: DecisionRequest) => 'ALLOW' | 'HOLD') {
  const calls: string[] = [];
  const bank: BankConnector = {
    reportAccount: async () => void calls.push('report'),
    observeNetwork: async () => void calls.push('network'),
    recordSecurityEvent: async (event) => {
      calls.push(`security:${event.eventType}`);
      return { eventId: event.eventId, outcome: 'RECORDED', posture: { accountId: event.accountToken, score: 0, band: 'LOW', contributions: [], evaluatedAt: event.occurredAt } } satisfies SecurityEventReceipt;
    },
    requestDecision: async (request) => {
      calls.push(`decide:${request.transactionId}`);
      return { transactionId: request.transactionId, decision: decideAs(request) } as DecisionResponse;
    },
    publishLifecycleEvent: async (event) => void calls.push(`publish:${event.transactionId}:${event.status}`),
  };
  return { bank, calls };
}

describe('playScenario', () => {
  const scenario = buildDemoTakeover01('2026-09-24T11:30:00.000Z');

  it('asks for a decision before publishing any lifecycle event for the same transfer', async () => {
    const { bank, calls } = recordingBank(() => 'ALLOW');
    await playScenario(scenario, bank, INSTANT_TIMELINE);
    const first = calls.findIndex((call) => call.startsWith('decide:'));
    const transactionId = calls[first]?.slice('decide:'.length);
    expect(calls.slice(first + 1, first + 3)).toEqual([`publish:${transactionId}:AUTHORISED`, `publish:${transactionId}:SETTLED`]);
  });

  it('never settles a held transfer', async () => {
    const { bank, calls } = recordingBank((request) => (request.amount === 1_150_000 ? 'HOLD' : 'ALLOW'));
    const report = await playScenario(scenario, bank, INSTANT_TIMELINE);
    const held = report.transfers.find((transfer) => transfer.response.decision === 'HOLD');
    expect(held).toBeDefined();
    expect(calls.filter((call) => call.startsWith(`publish:${held?.response.transactionId}`))).toEqual([]);
  });

  it('records security events before the transfers that depend on them', async () => {
    const { bank, calls } = recordingBank(() => 'ALLOW');
    await playScenario(scenario, bank, INSTANT_TIMELINE);
    const finalDecision = calls.findLastIndex((call) => call.startsWith('decide:'));
    expect(calls.indexOf('security:NEW_DEVICE')).toBeGreaterThan(-1);
    expect(calls.indexOf('security:NEW_DEVICE')).toBeLessThan(finalDecision);
    expect(calls.lastIndexOf('security:PAYEE_ADDED')).toBeLessThan(finalDecision);
  });
});
