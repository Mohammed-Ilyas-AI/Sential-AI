# Real-time stream

`sentinel-stream` watches three collections and sends normalised `StreamMessage`s over one WebSocket.

| Source collection | Message | Drives |
|---|---|---|
| `decisions` | `DECISION` (`DecisionRecord`) | The scored live tape and counters |
| `alerts` | `ALERT` (`Alert`) | The alert queue |
| `interventions` | `INTERVENTION` (`Intervention`) | Holds, the mock customer push, the audit trail |
| — | `SNAPSHOT` (`AccountSnapshot[]`) | Server truth on (re)connect |
| — | `HEARTBEAT` | Liveness under the 60-minute Cloud Run timeout |

Every message carries `cursor`, a server-issued global cursor (the change-stream resume token). The client sends
`SNAPSHOT_REQUEST` with `resumeFrom` after reconnecting; recovery must be invisible within 2 seconds.

Client side: `bufferTime(250)` → transaction worker → deltas only → one NgRx action per batch; the tape renders
at most 200 rows. No second live-transactions collection exists.
