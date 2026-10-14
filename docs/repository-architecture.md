# SENTINEL AI — Repository architecture

Source of truth: the three v1.2 documents (Master, Technical, Toolchain & Competition Compliance). This file
maps them onto the repository. Where the codebase amends v1.2 it says so and links the ADR.

> **Rules decide. AI explains. Humans authorize.** The policy gate never calls a language model, and the
> language model never returns a decision (T§12). The tree below exists to make that property structural.

## 0. Amendments to the v1.2 baseline

| v1.2 | Implementation | Record |
|---|---|---|
| Angular 20 | Angular 22.2.x, TypeScript 6.0.x, Node 24 LTS, NgRx 22, Vitest 5 | [ADR-001](decisions/ADR-001-angular-22.md) |
| Node.js 22 | Node.js 24 LTS (24.18.0) everywhere: `.nvmrc`, engines, Docker, Cloud Build | [ADR-007](decisions/ADR-007-node-24-lts.md) |
| Hold cascade (T§4) unspecified in detail | The threshold breach and every later eligible outflow are held until the trigger's cooling period ends or the customer verifies | [ADR-008](decisions/ADR-008-hold-cascade.md) |
| Single dark theme | Brand preset (SENTINEL AI, synthetic Bank A/B/C) × appearance (dark default, light), one token set, self-hosted fonts | [ADR-009](decisions/ADR-009-theme-system.md) |
| NgRx or signal store (open) | NgRx for cross-route domain state, Signals local, RxJS streams | [ADR-002](decisions/ADR-002-ngrx.md) |
| Decision route "then publish" | Synchronous decision writes PENDING; Pub/Sub carries later lifecycle only | [ADR-004](decisions/ADR-004-decision-pubsub-flow.md) |
| Security-event transport unspecified | `POST /v1/events/security`, synchronous | [ADR-004](decisions/ADR-004-decision-pubsub-flow.md) |
| Tape source unspecified | `sentinel-stream` watches `decisions`, `alerts`, `interventions` | [contracts/realtime-stream.md](contracts/realtime-stream.md) |
| Gemini on Vertex AI only, no API keys; single structured calls | Gemini API (key in Secret Manager) or Vertex AI behind one gateway; a bounded, read-only investigation agent using function calling | [ADR-010](decisions/ADR-010-gemini-provider-and-investigation-agent.md) |

## 1. Repository tree

```text
sentinel-ai/
├── apps/
│   ├── ui/                 Angular 22 SPA → Cloud Run service sentinel-ui
│   │   └── src/app/
│   │       ├── core/          config · http/{api-client,interceptors} · realtime/{websocket-client,reconnect,snapshot,stream-cursor} · tenant · error-handling · telemetry
│   │       ├── layout/        shell · top-bar · navigation
│   │       ├── features/      control-tower · live-transactions · fraud-alerts · investigations · network-analysis · cases · demo-controls
│   │       │                  (each: pages/ components/ data-access/ state/ models/ routes.ts index.ts)
│   │       ├── state/         session · alerts · transactions · interventions   (cross-route NgRx)
│   │       ├── shared/        ui/{risk-attribution,decision-trace,risk-band-badge} · pipes/minor-units-currency
│   │       ├── design-system/ tokens · themes/{sentinel,bank-a,bank-b,bank-c} · typography · motion · accessibility
│   │       └── workers/       transaction.worker.ts · transaction-worker-protocol.ts
│   ├── core/               Express → Cloud Run service sentinel-core
│   │   ├── src/
│   │   │   ├── main.ts · app.ts
│   │   │   ├── composition/   control-path · intelligence-path · mongo-persistence
│   │   │   ├── config/        environment · runtime-config · config-validation
│   │   │   ├── api/           http-route-registration · middleware/{cors,correlation-id,request-validation} · error-handler · health
│   │   │   ├── modules/       decision · risk · policy · interventions · accounts · transactions · security-events · alerts   (control path)
│   │   │   │                  investigations · intelligence · cases · graph                                              (intelligence path)
│   │   │   │                  (each: application/{*.use-case.ts,*.service.ts,ports/} [+ presentation/])
│   │   │   ├── infrastructure/ database/mongodb/{client,collections,repositories,indexes,serializers}
│   │   │   │                   messaging/pubsub/{push-envelope,transaction-event-consumer}
│   │   │   │                   ai/gemini/{endpoints,model-router,gateway,response-schemas,prompts}
│   │   │   │                   configuration · notifications · clock · telemetry
│   │   │   └── platform/      ids · audit · idempotency · correlation · time
│   │   └── test/              contracts · integration · scenario · support/{fixtures,in-memory-repositories}
│   ├── stream/             WebSocket gateway → Cloud Run service sentinel-stream
│   │   └── src/               config · connections · heartbeat · client-messages · messages · resume · snapshot · change-stream · telemetry
│   └── simulator/          Bank orchestrator stand-in → Cloud Run Job sentinel-simulator
│       └── src/               configuration · decision-api · security-event-api · pubsub-publisher · scenario-runner · timeline · telemetry
├── packages/
│   ├── domain/             contracts + documented constants; zero dependencies
│   │   └── src/               account · alert · case · constants · decision · errors · graph · intelligence · intervention
│   │                          money · policy · realtime · risk · security-event · tenant · time · transaction
│   ├── rules/              7 pure rules, risk engine, drain gate; depends on domain only
│   │   └── src/               rules/*.rule.ts · risk-engine · policy-gate
│   └── scenarios/          seeded PRNG, generators, DEMO_TAKEOVER_01; depends on domain only
│       └── src/               seed · generators/{baseline,noise,takeover,mule-network} · demo
├── infra/                  cloud-run/<deployable> · pubsub · mongodb · secret-manager · cloud-build · environments
├── docs/                   this file · architecture · contracts · decisions · deployment · compliance
├── CLAUDE.md · README.md · package.json · tsconfig.base.json · eslint.config.js · vitest.config.ts
└── .nvmrc (24.18.0) · .npmrc (engine-strict) · .env.example · .dockerignore
```

## 2. Top-level responsibilities

| Folder | Responsibility | Never contains |
|---|---|---|
| `apps/ui` | The analyst's single operator surface | Model credentials, database drivers, Google SDKs, scoring logic of its own |
| `apps/core` | Control path (decision, gate, audit) and intelligence path (evidence, Gemini) in one service, structurally separated | Business logic in controllers; SDK calls outside `infrastructure/` |
| `apps/stream` | Transport: change streams to WebSocket frames | Rules, policy, Gemini, business repositories, writes |
| `apps/simulator` | Plays the bank's payment orchestrator over seeded scenarios | Scoring (`@sentinel/rules` is forbidden) |
| `packages/domain` | Every shared contract and documented constant | Any dependency, any I/O |
| `packages/rules` | Deterministic rule engine shared by Node and the browser worker | I/O, frameworks, types that belong in domain, invented curves |
| `packages/scenarios` | Deterministic synthetic data | `Math.random`, wall-clock reads |
| `infra` | Deployment manifests and one-time runbooks | Credentials, Terraform, GKE |
| `docs` | Architecture, contracts, ADRs, deployment, compliance wording | Submission-only material in any language other than English |

## 3. Angular dependency direction

```text
app.routes / layout ──► features/<feature>/index.ts (public API only)
                              │
  page (composes) ──► component (presents, signal inputs) ──► shared/ui, shared/pipes
    │
    └──► data-access facade ──► NgRx (state/, feature state/) · core/http/api-client · core/realtime
                                          │
                                   @sentinel/domain contracts      workers/ ──► @sentinel/rules (optimistic arithmetic)
```

- `core/`, `shared/`, `state/`, `design-system/` and `workers/` never import a feature.
- A feature imports another feature only through its `index.ts`.
- Standalone, OnPush, zoneless; every feature route is lazy-loaded.

## 4. Backend dependency direction

```text
presentation (controller, routes, validator) ──► application use-case interface
application service ──► ports (interfaces) · @sentinel/rules · @sentinel/domain · platform/
infrastructure adapter ──implements──► port
composition/ ──constructs──► adapters + services   (main.ts is the process entry of the composition root)
```

Control path: `DecisionController → DecideTransaction (DecisionService) → ComputeRollingWindow,
EvaluateRapidDrainGate (drainGate), AssessTransactionRisk (assess, RISK_RULES) → DecisionRepository,
TransactionProjection, InterventionWorkflow`.

Intelligence path: `ManageCase → CompileEvidenceBundle → ExplainAndSummarise → ModelGateway →
GeminiModelGateway (ModelRouter, GeminiEndpoint)`, and `AdviseInvestigation → InvestigateWithAgent
(InvestigationAgentService, AgentEvidenceToolbox) → AgentModelGateway → GeminiModelGateway`, with
`ResponseSchemaValidator` and `SourceFieldValidator` in the application layer so the guardrail survives a
provider change ([ADR-010](decisions/ADR-010-gemini-provider-and-investigation-agent.md)).

## 5. Database boundary

MongoDB Atlas is the only operational store ([ADR-003](decisions/ADR-003-mongodb-atlas.md)). The eleven
collections, their document types and index specifications are in
`apps/core/src/infrastructure/database/mongodb/collections/`. Application code sees ports only. Invariants are
expressed by port shape: `InterventionRepository` (append, find — no update), `AssessmentRepository`
(insert, find), `TransactionEventLog` / `SecurityEventLog` (append, idempotent), `DecisionRepository`
(record, find by `idempotencyKey`). `sentinel-stream` reads MongoDB only through `change-stream/` and
`snapshot/`, read-only.

## 6. Pub/Sub boundary

The simulator publishes lifecycle `TransactionEvent`s (ordering key `sourceAccountToken`) from
`apps/simulator/src/pubsub-publisher/` only. `sentinel-core` receives them by push at
`/internal/pubsub/transaction-events`; `decodePushEnvelope` is the last place a Pub/Sub shape exists — the
application sees `ApplyTransactionLifecycleEvent` with a domain `TransactionEvent`. The consumer projects and
never scores ([ADR-004](decisions/ADR-004-decision-pubsub-flow.md)).

## 7. Gemini boundary

Only `apps/core/src/infrastructure/ai/gemini/gateway/gemini-model.gateway.ts` calls Gemini: through the Gemini
API with the key from Secret Manager, or through Vertex AI with the service account's credentials
(`GEMINI_PROVIDER`, [ADR-010](decisions/ADR-010-gemini-provider-and-investigation-agent.md)). Model IDs come from
configuration through `ModelRouter.resolve(job)`; there is no default model in code. The investigation agent's
tool declarations are versioned files in `prompts/`; every evidence tool is read-only. The system instruction is a versioned file in `prompts/`. `composition/control-path.composition.ts`
receives no model gateway, and the lint boundary rejects any import of `modules/intelligence`,
`modules/investigations`, `infrastructure/ai` or an AI SDK from the eight control-path modules.

## 8. WebSocket boundary

`apps/stream` watches `decisions` (the scored tape), `alerts` (the queue) and `interventions` (holds and the
audit trail), normalises each change into the domain `StreamMessage` union and fans it out. Cursor = change-stream
resume token. On reconnect the client requests a snapshot; the gateway holds nothing it cannot rebuild.

## 9. Shared package rules

| Package | May import | Enforced by |
|---|---|---|
| `@sentinel/domain` | nothing | lint + empty `dependencies` |
| `@sentinel/rules` | `@sentinel/domain` | lint; `lib: ES2023` and `types: []` (no DOM, no Node globals) |
| `@sentinel/scenarios` | `@sentinel/domain` | lint; `lib: ES2023` and `types: []` |

Tests inside a package may additionally import `vitest`. Packages build to `dist/`; workspaces resolve sources
through `tsconfig.base.json` `paths` for type-checking, Vitest aliases and the Angular build.

## 10. SOLID rules

| Principle | How it shows up |
|---|---|
| Single responsibility | The file suffix states the one role: `.controller`, `.routes`, `.validator`, `.use-case`, `.service`, `.port`, `.repository`, `.serializer`, `.rule`. Controllers only translate HTTP. |
| Open/closed | A new risk rule = one `*.rule.ts` + one entry in `rule-registry.ts` + the code in the domain union. No controller, repository or UI change: the UI renders `contributions[]` generically. |
| Liskov substitution | Every port has a Mongo adapter and an in-memory adapter, and both must pass the same contract suite (`apps/core/test/contracts/`). |
| Interface segregation | One port per capability and role; append-only ports expose no mutators; use-case interfaces are what controllers depend on. |
| Dependency inversion | Application imports ports, never `mongodb`, `@google-cloud/*`, `@google/genai` or `express`; only `composition/` wires concretions. |

Banned module names: `utils`, `helpers`, `common`, `misc`, `manager` (lint rule).

## 11. Naming conventions

| Where | Convention | Example |
|---|---|---|
| Angular components, directives, services | kebab-case file = PascalCase class, no type suffix | `transaction-tape.ts` → `TransactionTape` |
| Angular pipes, interceptors | `-pipe`, `-interceptor` | `minor-units-currency-pipe.ts`, `trace-id-interceptor.ts` |
| NgRx | `<slice>.feature.ts` (`createFeature`) | `alerts.feature.ts` |
| Angular selectors | `sentinel-` prefix, kebab-case | `sentinel-policy-hold` |
| Node and packages | `capability.role.ts` | `decision.service.ts`, `decision-repository.port.ts`, `mongo-decision.repository.ts` |
| Rules | `<rule>.rule.ts` | `rapid-drain.rule.ts` |
| Money | integer minor units named `amount`, `balance`, `outflow`… typed `MinorUnits` | `openingBalance: 5_200_000` |
| Time | UTC ISO 8601 strings typed `IsoTimestamp` | `decidedAt` |

## 12. Testing conventions

| Kind | Location | Runner |
|---|---|---|
| Unit | Co-located `*.spec.ts` | Vitest 5 (`vitest.config.ts` projects); `ng test` for `apps/ui` |
| Rule boundaries | `packages/rules/src/rules/*.rule.spec.ts` — codes, maxima and the curves ported from the HTML behavioural reference (ADR-006) | Vitest |
| Contract (LSP) | `apps/core/test/contracts/*.contract.ts`, run against every adapter | Vitest |
| Integration | `apps/core/test/integration/`, `apps/stream/test/integration/` — contracts, API smoke and change streams against Atlas, in a throwaway `<MONGODB_DATABASE>_it_<run>` database dropped afterwards; skipped when `.env` has no `MONGODB_URI` | `npm run test:integration` |
| Scenario | `apps/core/test/scenario/demo-takeover-01.scenario.spec.ts` — the CI assertion that matters | `npm run test:scenario` |

Synthetic identifiers only (`tok-acc-fixture-0001`); nothing that resembles an account number, NRIC or card.
