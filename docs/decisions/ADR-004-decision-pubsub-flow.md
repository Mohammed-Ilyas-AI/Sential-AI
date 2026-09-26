# ADR-004 — Synchronous decision first, Pub/Sub for the lifecycle afterwards

- **Status:** Accepted, 26 Sep 2026 (clarifies T§12 #9 and the v1.2 event model)

## Context

T§12 #9 puts a synchronous decision route on `sentinel-core` and then publishes "the same event" to Pub/Sub.
Scoring on the Pub/Sub path as well would score twice; projecting only from Pub/Sub would make the drain
arithmetic depend on Pub/Sub latency, with transfers one second apart in `DEMO_TAKEOVER_01`.

## Decision

```text
Simulator ── POST /v1/events/security ──► sentinel-core   (known devices, payees, cooling-off; synchronous)

Simulator ── POST /v1/decision/transactions (PENDING TransactionEvent) ──► sentinel-core
             rolling window → drain gate → risk assessment → DecisionResponse persisted
             → PENDING written to transaction_events + transactions projection → HOLD intervention if met
         ◄── DecisionResponse (ALLOW / HOLD / REJECT)

Simulator ── publish AUTHORISED / SETTLED / … (ordering key = sourceAccountToken) ──► Pub/Sub
Pub/Sub ── push ──► sentinel-core /internal/pubsub/transaction-events
             → transaction_events (dedupe on idempotencyKey) → transactions projection. Never scores.
```

- The decision never waits on Pub/Sub. Each transaction is scored exactly once, on the decision route.
- A HOLD is never settled by the simulator.
- A retried decision request with the same `idempotencyKey` returns the stored `DecisionResponse`.
- Ordering key: `sourceAccountToken` (tokenised; T§2 and T§14 over the older `accountId` wording).

## Consequences

- `sentinel-simulator` publishes (`roles/pubsub.publisher`); `sentinel-core` receives pushes and needs no
  Pub/Sub role.
- The push endpoint must verify the Pub/Sub OIDC token when the consumer is built (step 3), because
  `sentinel-core` also serves the browser and cannot require IAM invocation.
- Invalid push envelopes are rejected with 400; dead-lettering remains production-only.
