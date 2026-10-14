/** Target and hard ceiling per path, in milliseconds (T§10). Measured, not asserted. */
export const LATENCY_BUDGETS_MS = {
  pubSubPublishToDecision: { target: 80, ceiling: 200 },
  decisionToWebSocketFrame: { target: 40, ceiling: 120 },
  webSocketFrameToRenderedRow: { target: 300, ceiling: 500 },
  geminiFastFirstToken: { target: 800, ceiling: 2_000 },
  geminiDeepComplete: { target: 8_000, ceiling: 15_000 },
  graphTwoHopCachedQuery: { target: 150, ceiling: 600 },
} as const;

/** Transaction to visible, scored, gated row: the number quoted on stage. */
export const CONTROL_PATH_TOTAL_BUDGET_MS = 500;

/** A dropped WebSocket must recover invisibly within this time. */
export const WEBSOCKET_RECOVERY_BUDGET_MS = 2_000;

/**
 * Wall-clock ceiling for one investigation-agent run: several deep-tier turns, progress shown in the UI. Past it
 * the run ends as MODEL_UNAVAILABLE and the deterministic attribution stands.
 */
export const AGENT_INVESTIGATION_DEADLINE_MS = 90_000;
