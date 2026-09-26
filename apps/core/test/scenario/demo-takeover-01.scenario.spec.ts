import { describe, it } from 'vitest';

/**
 * The test that matters (C§7, T§9): DEMO_TAKEOVER_01 driven headless through the real DecisionService
 * against in-memory adapters. If it fails, the demo is broken and we know before the judges do.
 */
describe('DEMO_TAKEOVER_01 through the control path', () => {
  it.todo('reaches a final score of exactly 95');
  it.todo('keeps contributions[] summing to the displayed score at every step');
  it.todo('meets the rapid-drain threshold on the fourth transfer (step 7) and not before');
  it.todo('leaves the intervention state HELD after the fourth transfer');
  it.todo('produces the six documented contribution codes and point values');
  it.todo('counts a PENDING then SETTLED pair for the same transaction once');
  it.todo('returns the stored DecisionResponse for a retried idempotencyKey');
});
