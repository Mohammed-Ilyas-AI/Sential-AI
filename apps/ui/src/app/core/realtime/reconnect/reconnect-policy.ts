import { WEBSOCKET_RECOVERY_BUDGET_MS } from '@sentinel/domain';

/** Exponential backoff; a dropped connection must recover invisibly within WEBSOCKET_RECOVERY_BUDGET_MS. */
export interface ReconnectPolicy {
  delayForAttempt(attempt: number): number;
}

/** 200, 400, 800 ms, then every second: the first retries land well inside the 2-second budget. */
export const EXPONENTIAL_RECONNECT: ReconnectPolicy = {
  delayForAttempt: (attempt) => Math.min(200 * 2 ** Math.max(0, attempt - 1), WEBSOCKET_RECOVERY_BUDGET_MS / 2),
};
