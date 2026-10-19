# sentinel-core HTTP API

Controllers are thin; bodies are validated in middleware before a controller runs. Every response carries
`X-Trace-Id`. Validation failures answer `400 { error: 'invalid_request', problems[] }`; an unknown route answers a
JSON `404`.

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

## Account controls

| Method | Path | Body → Response | Status |
|---|---|---|---|
| `GET` | `/v1/accounts/:accountToken/kill-switch` | — → current state and append-only history | 200; 403 cross-lens; 404 |
| `POST` | `/v1/accounts/:accountToken/kill-switch` | `{ analystIdentity, reason, idempotencyKey, confirmAccountId }` → stored state transition | 201; 200 idempotent retry; 409 conflict |
| `POST` | `/v1/accounts/:accountToken/kill-switch/customer-verified-release` | `{ idempotencyKey }` → customer-verified lift | 201; 200 retry; 409 |
| `GET` | `/v1/accounts/:accountToken/customer-contacts` | — → `{ accountId, contacts }` | 200 |
| `POST` | `/v1/accounts/:accountToken/customer-contacts` | `{ analystIdentity, channel, outcome, idempotencyKey, note?, transactionId?, caseId? }` → simulated attempt record | 201; 200 retry |

Contact records are explicitly simulated; no external customer messaging is performed. `channel` is `PHONE`,
`SECURE_MESSAGE`, `IN_APP_PUSH`, `AUTOMATED_CALL` or `EMAIL` (the last two are system-generated from the outreach
draft). Kill-switch release has no analyst route and uses the customer-verification path. While an account's kill
switch is active, the cooling-period auto-release skips its holds; they are released on a later pass once the
customer has verified and the switch is lifted.

## Intelligence and network path

| Method | Path | Body → Response | Status |
|---|---|---|---|
| `POST` | `/v1/network/observations` | `NetworkObservation` → `{ nodes, edges }` | 202 |
| `GET` | `/v1/network/:rootId/neighbourhood?hops=1|2` | — → capped nodes, provenance-bearing edges, tenant projection and observed boundaries | 200; 400 invalid depth; 404 unknown root |
| `GET` | `/v1/network/:rootId/fund-trace?via=:entityId` | — → ordered observed transfer path and explicit observability stop reason | 200; 404 unknown root |
| `GET` | `/v1/investigations/:assessmentId/evidence` | — → persisted `EvidenceBundle` | 200; 404 |
| `POST` | `/v1/investigations/:assessmentId/explanation` | — → grounded advisory or explicit fallback | 200 |
| `POST` | `/v1/investigations/:assessmentId/case-summary` | — → grounded advisory or explicit fallback | 200 |
| `POST` | `/v1/investigations/:assessmentId/customer-outreach` | — → `CustomerOutreachProposal`: `{ source: GEMINI \| TEMPLATE, draft: { subject, emailBody, callScript }, model }` | 200 |

The customer outreach draft is the fast tier's `CUSTOMER_OUTREACH` job on a customer-facing slice of the bundle (the
assessment, the drain and the paused transfer only). A draft carrying a link, a phone number, a request for a secret or
a promise of release is rejected; on any fallback sentinel-core returns its fixed wording, so a message is always
ready. Sending it is a separate, recorded contact attempt.

Graph queries use bounded indexed traversal over recorded edges; they do not create evidence. `x-sentinel-lens`
projects other-institution references and values before response serialization. Investigation requests resolve
the assessment's account and deny a cross-lens evidence or advisory read before bundle compilation. This is a
synthetic demonstration lens, not authentication or production tenant isolation.

## Cases and reports

| Method | Path | Body → Response | Status |
|---|---|---|---|
| `GET` | `/v1/cases?limit=100` | — → `{ cases, limit }`, limited to 1–200 | 200 |
| `POST` | `/v1/cases` | `{ alertId, analystIdentity }` → `{ outcome, record }` | 201 new; 200 duplicate |
| `GET` | `/v1/cases/:caseId` | — → persisted case and compiled evidence | 200; 403; 404 |
| `POST` | `/v1/cases/:caseId/escalate` | `{ analystIdentity }` → updated case | 200; 409 invalid transition |
| `POST` | `/v1/cases/:caseId/report` | `{ analystIdentity }` → `{ outcome, record }` with first editable evidence-backed draft | 201 new; 200 duplicate |
| `GET` | `/v1/cases/:caseId/report` | — → latest report and version summaries | 200; 404 |
| `PATCH` | `/v1/cases/:caseId/report/:version` | `{ analystIdentity, expectedRevision, edits[] }` → updated draft | 200; 409 revision conflict; 422 invalid section |
| `POST` | `/v1/cases/:caseId/report/:version/sign-off` | `{ analystIdentity, expectedRevision }` → immutable signed version | 200; 409; 422 incomplete draft |
| `POST` | `/v1/cases/:caseId/report/revision` | `{ analystIdentity, fromVersion }` → new draft version | 201; 409 |
| `GET` | `/v1/cases/:caseId/report/:version/export` | — → the saved version as `application/pdf` (drafts marked "not signed off") | 200; 403; 404 |

All report writes and exports are audited. Draft edits use optimistic revision checks; signed-off versions cannot
be modified. A grounded summary is included only when a validated result was already archived; report generation
itself makes no model call.

## Audit and performance

| Method | Path | Body → Response | Status |
|---|---|---|---|
| `GET` | `/v1/audit-events?limit=200&category=CASE_REPORT` | — → append-only audit events, restricted by lens when present | 200 |
| `GET` | `/v1/metrics/performance` | — → five-minute, process-local request counts, failures and latency distributions | 200 |

Performance labels are fixed route names and contain no account or transaction identifiers. Percentiles are `null`
when a measured path has no samples; `budget` carries the T§10 target where one is defined. Stream delivery,
worker-batch, message-to-row and render passes are measured in the browser by the performance panel (Ctrl Shift P),
not by this endpoint.

## Scenario launch

| Method | Path | Body → Response | Status |
|---|---|---|---|
| `GET` | `/v1/demo/scenario-runs/capability` | — → `{ available, launcher, reason? }` | 200 |
| `GET` | `/v1/demo/scenario-runs` · `/v1/demo/scenario-runs/:runId` | — → `{ runs }` · `ScenarioRun` (refreshed from the launcher while running) | 200; 404 |
| `POST` | `/v1/demo/scenario-runs` | `{ analystIdentity, idempotencyKey, noise: { seed, ratePerMinute } \| null }` → `{ outcome, record }` | 202; 200 retry; 409 run active or launcher disabled; 422 |

`SCENARIO_LAUNCHER` chooses the launcher: `disabled` (default; the UI shows why), `local-process` (local development:
starts the simulator workspace with `SIMULATOR_RUN_ID` and the noise settings) or `cloud-run-job` (executes the existing
`sentinel-simulator` job through the Cloud Run Admin API with sentinel-core's own identity; needs
`run.jobs.runWithOverrides` on that job, and is not exercised by this repository's tests). One run at a time; the
browser never holds a job name, command or credential. Seeded noise is off by default, bounded to 1–60 events per
minute, uses its own run-scoped synthetic accounts and never changes DEMO_TAKEOVER_01.

### Live demo

| Method | Path | Body → Response | Status |
|---|---|---|---|
| `POST` | `/v1/demo/live-demo` | `{ analystIdentity }` → `LiveDemoReport`: `{ runId, transfers, held: [{ transactionId, assessmentId, accountId, amount, riskScore, holdUntil? }] }` | 200 after about 46 s; 400; 409 already running |

Plays DEMO_TAKEOVER_01 in-process through the same use cases the bank-facing routes call, on fresh run-scoped
synthetic accounts, within the request (so it keeps CPU on Cloud Run and needs no job or extra resource). One run at
a time per instance; audited as `LIVE_DEMO_STARTED`. The UI's Live demo button then walks the case through
Investigations as the demo analyst.

## Idempotency

`POST /v1/decision/transactions`, `POST /v1/events/security` and the Pub/Sub push route are keyed by
`idempotencyKey` (security events by `eventId`). A retry returns the stored record and never re-scores; a
lifecycle event counts once. Cases are unique per alert; report versions are unique per case and version.
