import { syntheticToken } from './synthetic-token.js';

/**
 * One execution of a scenario. Every identifier a run emits — event IDs, transaction IDs, idempotency keys and the
 * synthetic account, device and payee tokens — is scoped to it, so a second run against the same database is new
 * activity on fresh synthetic accounts (its own empty 24-hour window), while a retry inside a run is still the same
 * event and is deduplicated. Without a run ID, identifiers are exactly the canonical, unscoped ones.
 */
export type ScenarioRunId = string;

const RUN_ID_PATTERN = /^[A-Z0-9]{1,12}$/;

export function isScenarioRunId(value: string): boolean {
  return RUN_ID_PATTERN.test(value);
}

/** Time-based, not random: scenarios stay reproducible from their seed, and two runs a millisecond apart differ. */
export function newScenarioRunId(nowMs: number): ScenarioRunId {
  return Math.trunc(nowMs).toString(36).toUpperCase();
}

export function runScopedToken(prefix: 'acct' | 'dev' | 'ben', identifier: string, runId?: ScenarioRunId): string {
  return syntheticToken(prefix, runId ? `${runId}/${identifier}` : identifier);
}
