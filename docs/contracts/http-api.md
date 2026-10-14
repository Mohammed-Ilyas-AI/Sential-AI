# sentinel-core HTTP API

Controllers are thin; bodies are validated in middleware before a controller runs. Every response carries
`X-Trace-Id`. Validation failures answer `400 { error: 'invalid_request', problems[] }`; an unknown route answers a
JSON `404`; capabilities not yet built answer `501 not_implemented`.

## Control path

| Method | Path | Body → Response | Status |
|---|---|---|---|
| `GET` | `/healthz` | — → `{ status, uptimeSeconds }` | 200 |
| `PUT` | `/v1/accounts/:accountToken` | `BankAccountReport` → `{ accountToken, protected }` | 200 |
| `POST` | `/v1/events/security` | `AccountSecurityEvent` → `SecurityEventReceipt` (`RECORDED` or `DUPLICATE`, with the account posture) | 200 |
| `POST` | `/v1/decision/transactions` | `DecisionRequest` (a `PENDING` `TransactionEvent`) → `DecisionResponse` | 200 |
| `POST` | `/internal/pubsub/transaction-events` | Pub/Sub push envelope carrying a lifecycle `TransactionEvent` → `{ outcome }` (`PROJECTED`, `DUPLICATE`, `HISTORY_ONLY`) | 200; 400 bad envelope or event; 401 failed OIDC |

`/internal/pubsub/transaction-events` verifies the push OIDC token when `PUBSUB_PUSH_VERIFICATION=google-oidc`
(audience `PUBSUB_PUSH_AUDIENCE`, signer `PUBSUB_PUSH_SERVICE_ACCOUNT`). `disabled-for-local-development`
exists only for local runs; deployed services use `google-oidc`.

## Interventions (append-only)

| Method | Path | Body → Response | Status |
|---|---|---|---|
| `GET` | `/v1/interventions/:transactionId` | — → `{ transactionId, history: Intervention[] }` | 200 |
| `POST` | `/v1/interventions/:transactionId/customer-verified-release` | — → `Intervention` (`HELD` → `RELEASED`, actor `CUSTOMER`) | 200; 404; 409 if not held |
| `POST` | `/v1/interventions/:transactionId/customer-cancellation` | — → `Intervention` (`HELD` → `CANCELLED`, actor `CUSTOMER`) | 200; 404; 409 |
| `POST` | `/v1/interventions/:transactionId/fraud-confirmation` | `{ analystIdentity }` → `Intervention` (`HELD` → `REJECTED`, actor `ANALYST`) | 200; 404; 409 |

There is no analyst release: the analyst never overturns the policy. Holds that reach `holdUntil` are released
by the scheduler (actor `SYSTEM`).

## Intelligence path

| Method | Path | Body → Response | Status |
|---|---|---|---|
| `POST` | `/v1/network/observations` | `NetworkObservation` → `{ nodes, edges }` | 202 |
| `GET` | `/v1/investigations/:assessmentId/evidence` | — → `InvestigationEvidence` (the bundle exactly as Gemini receives it) | 200; 404 |
| `POST` | `/v1/investigations/:assessmentId/explanation` | — → `AdvisoryOutcome<RiskExplanation>` (fast tier, cached by assessment) | 200; 404 |
| `POST` | `/v1/investigations/:assessmentId/case-summary` | — → `AdvisoryOutcome<CaseSummary>` (deep tier) | 200; 404 |
| `POST` | `/v1/investigations/:assessmentId/agent-investigation` | — → `AdvisoryOutcome<AgentInvestigation>`: the agent's tool trace and grounded findings (ADR-010) | 200; 404 |

A `FALLBACK` outcome is a 200: the advisory is optional and the deterministic attribution is not. No response
here can alter a score, a decision or a hold. Graph queries and case-report routes arrive with their build steps.

## Idempotency

`POST /v1/decision/transactions`, `POST /v1/events/security` and the Pub/Sub push route are keyed by
`idempotencyKey` (security events by `eventId`). A retry returns the stored record and never re-scores; a
lifecycle event counts once.
