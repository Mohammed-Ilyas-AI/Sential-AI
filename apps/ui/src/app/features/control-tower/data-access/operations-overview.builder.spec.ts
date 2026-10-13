import { describe, expect, it } from 'vitest';
import { decisionRecord, demoAlert, demoFinalDecision, demoHold, demoThirdDecision } from '../../../../testing/ui-fixtures';
import { processTransactionBatch } from '../../../workers/transaction-batch.processor';
import {
  buildGlobeCallouts,
  buildGlobeScene,
  buildKpis,
  buildNetworkStats,
  buildPolicyGate,
  buildRiskAnalysis,
  buildStreamRows,
  buildThreatLandscape,
} from './operations-overview.builder';

const rows = processTransactionBatch([
  demoFinalDecision(),
  demoThirdDecision(),
  decisionRecord({ transactionId: 'txn_early', occurredAt: '2026-09-24T00:59:00.000Z' }),
]).rows;

describe('operations overview', () => {
  it('counts what the store holds and never invents a figure', () => {
    const kpis = buildKpis(rows, [demoAlert()], [demoHold()]);
    expect(kpis.map((kpi) => [kpi.label, kpi.value])).toEqual([
      ['Live Transactions', 3],
      ['High Risk Alerts', 1],
      ['Held Transactions', 1],
      ['Monitored Banks', 3],
    ]);
    expect(kpis.every((kpi) => kpi.series.length === 24)).toBe(true);
  });

  it('reports no change for an empty tape rather than a made-up trend', () => {
    expect(buildKpis([], [], []).map((kpi) => kpi.changePercent)).toEqual([0, 0, 0, 0]);
  });

  it('turns every transfer into a route coloured by what the gate and the score said', () => {
    const scene = buildGlobeScene(rows);
    const tones = Object.fromEntries(scene.routes.map((route) => [route.id, route.tone]));
    expect(tones).toEqual({ txn_demo_final: 'held', txn_demo_third: 'high', txn_early: 'normal' });
    expect(scene.markers.find((marker) => marker.id === 'BANK_C')?.tone).toBe('held');
    expect(scene.holds).toHaveLength(1);
    expect(scene.nodes).toHaveLength(2);
  });

  it('places an account on the same node every time', () => {
    const first = buildGlobeScene(rows).nodes;
    const again = buildGlobeScene(rows).nodes;
    expect(again).toEqual(first);
  });

  it('pins one callout per institution, the hold taking precedence', () => {
    expect(buildGlobeCallouts(rows)).toEqual([
      { id: 'BANK_C', institution: 'Bank C', amount: 1_150_000, label: 'HOLD', detail: 'Rapid-drain pattern', tone: 'held' },
      { id: 'BANK_B', institution: 'Bank B', amount: 720_000, label: 'Under review', tone: 'high' },
      { id: 'BANK_A', institution: 'Bank A', amount: 12_000, label: 'Legitimate', tone: 'normal' },
    ]);
  });

  it('counts banks, routes and accounts from the tape', () => {
    expect(buildNetworkStats(rows)).toEqual({ banksConnected: 3, activeRoutes: 3, accountsMonitored: 2 });
  });

  it('lists the five latest decisions with review for allowed high-risk transfers', () => {
    expect(buildStreamRows(rows).map((row) => [row.status, row.from, row.to, row.score])).toEqual([
      ['HOLD', 'Bank A', 'Bank C', 95],
      ['REVIEW', 'Bank A', 'Bank B', 75],
      ['ALLOWED', 'Bank B', 'Bank A', 5],
    ]);
  });

  it('groups the threat landscape by band', () => {
    const view = buildThreatLandscape(rows);
    expect([view.high, view.elevated, view.normal]).toEqual([2, 0, 1]);
    expect(view.hotspots.find((hotspot) => hotspot.id === 'BANK_C')?.level).toBe('high');
  });

  it('summarises the risk of the account in focus, largest contribution first', () => {
    const view = buildRiskAnalysis(demoFinalDecision());
    expect(view?.score).toBe(95);
    expect(view?.contributions.map((contribution) => contribution.code)).toEqual(['RAPID_DRAIN', 'NEW_DEVICE', 'NEW_PAYEE', 'VELOCITY', 'ENTITY_LINK']);
    expect(buildRiskAnalysis(null)).toBeNull();
  });

  it('states the gate outcome and what happens next', () => {
    const held = buildPolicyGate(demoFinalDecision(), demoHold(), 50);
    expect(held).toMatchObject({ decision: 'HOLD', thresholdMet: true, protectedAccount: true, interventionTitle: 'Intervention required' });
    expect(held?.drainPct.toFixed(1)).toBe('65.4');
    const released = buildPolicyGate(demoFinalDecision(), demoHold({ state: 'RELEASED', actor: 'CUSTOMER' }), 50);
    expect(released).toMatchObject({ interventionTitle: 'Hold released', interventionDetail: 'Released by customer' });
    expect(buildPolicyGate(demoThirdDecision(), null, 50)?.interventionTitle).toBe('No intervention');
  });
});
