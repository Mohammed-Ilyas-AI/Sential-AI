import { DEMO_TAKEOVER_01 } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import { buildDemoTakeover01 } from '../demo/demo-takeover-01.js';
import { buildSeededNoiseScenario } from './noise.generator.js';

describe('seeded background noise', () => {
  it('replays identical events for the same seed while using separate run-scoped accounts and IDs', () => {
    const first = buildSeededNoiseScenario('2026-09-24T11:30:00.000Z', 4201, 'NOISE1', 4);
    const replay = buildSeededNoiseScenario('2026-09-24T11:30:00.000Z', 4201, 'NOISE1', 4);
    const canonical = buildDemoTakeover01('2026-09-24T11:30:00.000Z');
    expect(first).toEqual(replay);
    expect(first.timeline.filter((step) => step.action === 'TRANSFER')).toHaveLength(4);
    expect(JSON.stringify(first)).not.toContain(DEMO_TAKEOVER_01.accountDisplayId);
    expect(JSON.stringify(first)).not.toContain(canonical.timeline.find((step) => step.action === 'TRANSFER')?.request.transactionId);
  });

  it('rejects unbounded counts and invalid replay identities', () => {
    expect(() => buildSeededNoiseScenario('2026-09-24T11:30:00.000Z', 1, 'RUN2', 0)).toThrow(RangeError);
    expect(() => buildSeededNoiseScenario('2026-09-24T11:30:00.000Z', 1, 'RUN2', 61)).toThrow(RangeError);
    expect(() => buildSeededNoiseScenario('2026-09-24T11:30:00.000Z', 1, 'bad-run', 1)).toThrow(RangeError);
  });
});
