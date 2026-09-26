# sentinel-core HTTP API

Controllers are thin; bodies are validated in middleware before a controller runs. Every response carries
`X-Trace-Id`. Unbuilt capabilities answer `501 not_implemented`.

| Method | Path | Body → Response | Status | Build step |
|---|---|---|---|---|
| `GET` | `/healthz` | — → `{ status, uptimeSeconds }` | live | — |
| `POST` | `/v1/decision/transactions` | `DecisionRequest` → `DecisionResponse` | wired, 501 | 3 |
| `POST` | `/v1/events/security` | `AccountSecurityEvent` → `202` | wired, 501 | 6 |
| `POST` | `/internal/pubsub/transaction-events` | Pub/Sub push envelope carrying a `TransactionEvent` → `204` | wired, 400 on bad envelope, 501 after | 3 |

Analyst actions (contact customer, release after customer verification, kill switch, confirm fraud, escalate),
investigation, graph and case-report routes are added with their build steps; they will live in the owning
module's `presentation/`.

## Idempotency

`POST /v1/decision/transactions` and `POST /v1/events/security` are keyed by `idempotencyKey`. A retry returns
the stored record and never re-scores.
