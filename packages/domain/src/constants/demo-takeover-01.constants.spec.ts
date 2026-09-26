import { describe, expect, it } from 'vitest';
import { DEMO_TAKEOVER_01 } from './demo-takeover-01.constants.js';
import { RAPID_DRAIN_GATE_PERCENT } from './policy.constants.js';

describe('DEMO_TAKEOVER_01 constants (T§9)', () => {
  const transfers = DEMO_TAKEOVER_01.steps.filter((step) => step.action === 'TRANSFER');
  const cumulativeOutflows = transfers.reduce<number[]>(
    (outflows, transfer) => [...outflows, (outflows.at(-1) ?? DEMO_TAKEOVER_01.priorOutflowInWindow) + transfer.amount],
    [],
  );

  it('prior outflow plus the four transfers equals the S$34,000 moved in the window', () => {
    expect(cumulativeOutflows.at(-1)).toBe(DEMO_TAKEOVER_01.totalMovedInWindow);
  });

  it('reproduces the documented drain percentages of 29.4%, 43.3% and 65.4%', () => {
    const drainPercents = cumulativeOutflows.map(
      (outflow) => Math.round((outflow / DEMO_TAKEOVER_01.openingBalance) * 1000) / 10,
    );
    expect(drainPercents.slice(1)).toEqual([29.4, 43.3, 65.4]);
  });

  it('crosses the strict 50% gate on the fourth transfer and not before', () => {
    const firstOverGate = cumulativeOutflows.findIndex(
      (outflow) => outflow * 100 > DEMO_TAKEOVER_01.openingBalance * RAPID_DRAIN_GATE_PERCENT,
    );
    expect(firstOverGate + 1).toBe(DEMO_TAKEOVER_01.thresholdMetOnTransfer);
  });

  it('final contributions sum to the final score of 95', () => {
    const total = Object.values(DEMO_TAKEOVER_01.finalContributions).reduce((sum, points) => sum + points, 0);
    expect(total).toBe(DEMO_TAKEOVER_01.finalScore);
  });
});
