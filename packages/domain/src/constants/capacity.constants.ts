export const EVIDENCE_RECENT_TRANSACTIONS_CAP = 50;

export const GRAPH_MAX_HOPS = 2;

export const GRAPH_NODE_CAP = 40;

export const GRAPH_EDGE_CAP = 120;

/** Render on canvas rather than SVG above this many nodes. */
export const GRAPH_CANVAS_RENDER_THRESHOLD_NODES = 60;

export const CASE_SUMMARY_HYPOTHESIS_MAX_CHARS = 300;

export const CASE_SUMMARY_EVIDENCE_MAX_ITEMS = 5;

/** An unparseable or schema-invalid model response is retried once, then the UI shows the attribution alone. */
export const MODEL_RESPONSE_MAX_RETRIES = 1;

export const TRANSACTION_TAPE_MAX_ROWS = 200;

export const STREAM_BUFFER_WINDOW_MS = 250;

/** Evidence-gathering turns the investigation agent may take before it must submit its findings. */
export const AGENT_MAX_TOOL_ROUNDS = 5;

/** Tool calls the agent may make in one turn; extra calls in the same turn are refused, not executed. */
export const AGENT_MAX_CALLS_PER_ROUND = 4;
