/** Exponential backoff; a dropped connection must recover invisibly within WEBSOCKET_RECOVERY_BUDGET_MS. */
export interface ReconnectPolicy {
  delayForAttempt(attempt: number): number;
}
