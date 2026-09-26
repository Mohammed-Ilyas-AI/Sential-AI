/** Keeps idle sockets alive under the 60-minute Cloud Run request timeout and detects dead clients. */
export interface HeartbeatPolicy {
  readonly intervalMs: number;
  readonly missedBeatsBeforeDisconnect: number;
}
