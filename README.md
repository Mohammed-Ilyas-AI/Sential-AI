# SENTINEL AI

**All data in this project is synthetic.** No real, scraped or anonymised customer data is used anywhere, and no
identifier resembles a real account number, NRIC or card number. SENTINEL AI is a functional prototype of a
control, with the security posture of a prototype.

SENTINEL AI is a real-time fraud operations control tower for retail banking: **Detect. Explain. Intervene.
Investigate.** It implements Singapore's rapid account-draining safeguard (protected balance S$50,000; a
transaction that, with the previous 24 hours of outflows, moves more than 50% of the balance is held) as a
deterministic policy gate, and uses Gemini to explain decisions that the rules have already made, including a
Gemini investigation agent that gathers evidence through read-only tools and files grounded findings.

**Rules decide. AI explains. Humans authorize.** No language model sits in the path of a financial decision.

Built for the AI Builder Cup 2026, theme **BFSI — Intelligent Risk, Fraud & Financial Experiences**. Designed as
a multi-tenant platform; demonstrated as a single deployment on synthetic data.

## Status

Architecture skeleton. Contracts, boundaries, composition roots, test boundaries and deployment manifests are in
place; business capabilities are wired but not implemented (they answer `501 not_implemented`). Nothing is
deployed yet.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Angular 22 (standalone, zoneless), NgRx, Signals, RxJS, Web Workers |
| Backend | Node.js 24 LTS, TypeScript 6, Express 5 on Cloud Run |
| Data | MongoDB Atlas on Google Cloud (`asia-southeast1`) |
| Messaging | Google Cloud Pub/Sub (ordered per account token) |
| Real time | WebSocket gateway on Cloud Run, fed by MongoDB change streams |
| AI | Gemini (Gemini API or Vertex AI), called only from `sentinel-core`: structured explanations and summaries, and a function-calling investigation agent |
| CI/CD | Cloud Build → Artifact Registry → Cloud Run |

There are no keys or credentials in this repository. The deployed `sentinel-core` reaches Gemini with a Gemini API
key held in Secret Manager (`gemini-api-key`), readable only by its own service account. The key is sent only in a
request header and never reaches the browser or a log. Alternatively, `GEMINI_PROVIDER=vertex-ai` uses the service
account's own credentials and no key. The Atlas connection string is the other secret, also in Secret Manager. See
[ADR-010](docs/decisions/ADR-010-gemini-provider-and-investigation-agent.md).

## Repository

```text
apps/ui          Angular control tower            → Cloud Run service sentinel-ui
apps/core        decision API, ingest, Gemini     → Cloud Run service sentinel-core
apps/stream      WebSocket gateway                → Cloud Run service sentinel-stream
apps/simulator   synthetic bank orchestrator      → Cloud Run Job     sentinel-simulator
packages/domain  shared contracts and constants
packages/rules   deterministic rules (Node and browser worker)
packages/scenarios seeded scenarios, DEMO_TAKEOVER_01
infra/           Cloud Run, Pub/Sub, Atlas, Secret Manager, Cloud Build
docs/            architecture, contracts, decisions (ADRs), deployment, compliance
```

Start with [docs/repository-architecture.md](docs/repository-architecture.md).

## Quick start

Requires Node.js **24 LTS** (24.18.0 in `.nvmrc`; other major versions are rejected by `engine-strict`).

```bash
npm install
npm run verify
```

`npm run verify` runs typecheck, lint (including the architecture boundary rules), all tests and all builds.

To run against MongoDB Atlas, copy `.env.example` to `.env` (gitignored) and set `MONGODB_URI` and
`MONGODB_DATABASE=sentinel_ai`, then:

```bash
npm run test:integration
```

The integration suites create a throwaway database per run and drop it afterwards; they never touch
`sentinel_ai` itself.

## Google AI usage

| Model tier | Jobs | Called from |
|---|---|---|
| Fast (Gemini Flash-class, ID from configuration) | Risk explanation, alert enrichment, entity summary, next-step suggestion | `sentinel-core` intelligence path |
| Deep (Gemini Pro-class, ID from configuration) | Case summary, evidence correlation, case report draft | `sentinel-core` intelligence path |

Every call uses structured output against a response schema; every claim must cite a field of the evidence
bundle it was given. The model may not add, remove or re-weight a risk contribution and may not recommend
releasing a held transaction. Explanations are cached by assessment and the demo account's explanation is
pre-warmed before a presentation.
