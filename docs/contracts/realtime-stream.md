# Real-time stream

`sentinel-stream` watches three collections through one database-level change stream and sends normalised
`StreamMessage`s over one WebSocket at `/stream`. It is transport only: it never scores, decides or writes.

| Source collection | Message | Drives |
|---|---|---|
| `decisions` | `DECISION` (`DecisionRecord`) | The scored live tape, the rapid-drain panel and the counters |
| `alerts` | `ALERT` (`Alert`) | The alert queue |
| `interventions` | `INTERVENTION` (`Intervention`) | Hold state, the mock customer push, the timeline |
| — | `SNAPSHOT` (`StreamSnapshot { decisions, alerts, interventions }`) | Server truth on connect and on request |
| — | `HEARTBEAT` | Liveness under the 60-minute Cloud Run timeout |

Every message carries `cursor`, a server-issued global cursor (the change-stream resume token), and `emittedAt`.

- **Connect.** The upgrade is refused unless `Origin` equals `STREAM_ALLOWED_ORIGIN`. The server sends a
  `SNAPSHOT` first.
- **Reconnect.** The client reconnects with backoff (200, 400, 800 ms, then every second) and receives a fresh
  `SNAPSHOT`, which replaces its state; recovery must be invisible within 2 seconds. A client may also send
  `{ kind: 'SNAPSHOT_REQUEST' }`.
- **Liveness.** Ping/pong every `STREAM_HEARTBEAT_INTERVAL_MS`; a peer that misses a pong is closed.

Client side (`apps/ui`): `bufferTime(250)` on `DECISION` messages → transaction worker → one NgRx
`Batch Processed` action per batch; `ALERT` and `INTERVENTION` messages apply at once. The tape renders at most
200 rows, deduplicated by `transactionId`. No second live-transactions collection exists.
