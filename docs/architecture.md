# Architecture

## Flow

```
  transaction source (synthetic generator)
            │
            ▼
      Pub/Sub topic  sentinel-transactions
            │
            ▼
  ┌─────────────────────────────────────────┐
  │  apps/api  (Cloud Run)                  │
  │                                         │
  │  ingest ──► rule engine ──► risk score  │
  │                   │                     │
  │                   ├──► policy engine    │ rapid-drain check
  │                   │         │           │
  │                   │         ▼           │
  │                   │    hold / release   │
  │                   │                     │
  │                   └──► explanation svc ─┼──► Vertex AI (Gemini)
  │                                         │
  │  case store ◄───────────────────────────┤
  └─────────────────────────────────────────┘
            │  SSE / WebSocket
            ▼
  apps/web  (Angular 20 control tower)
```

## Components

**Ingest** (`api/src/routes/transactions.ts`)
Accepts a transaction, validates it against the shared schema, enriches it with account
context, and hands it to scoring.

**Rule engine** (`api/src/services/rules/`)
Deterministic signals: new payee, unusual hour, velocity, amount deviation from the
account's own baseline, device change. Each rule emits a `RiskSignal` with a weight and a
plain-language reason. Rules are data, not code branches — adding a rule is adding an
entry.

**Policy engine** (`api/src/services/policy/`)
Separate from scoring on purpose. Scoring says how risky something looks; policy says what
the bank is obliged to do about it. The rapid-drain control lives here and reads its
thresholds from config.

**Explanation service** (`api/src/services/explanation/`)
Takes the assessment and its signals, prompts Gemini, and returns a short narrative. The
prompt carries only the signals that fired — the model summarises evidence, it does not
supply evidence.

**Entity graph** (`api/src/services/graph/`)
Adjacency over accounts, devices and payees, walked to a bounded depth from a case.

**Web** (`apps/web`)
Angular 20 standalone components, signal-based state, one feature folder per surface.
Receives live updates over SSE.

## Decisions

- **Scoring and policy are separate services.** A regulator asks "why did you let this
  through?" — the answer has to distinguish "we scored it low" from "it did not breach
  the control".
- **Node over Python for the API.** The team's depth is TypeScript, and the prototype is
  streaming and orchestration rather than model training.
- **No model in the request path for detection.** Rules score; Gemini explains. Keeps
  latency predictable and keeps the decision auditable.
