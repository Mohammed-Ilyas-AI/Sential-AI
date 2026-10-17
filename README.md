# SENTINEL AI

**All data in this project is synthetic.** No real, scraped or anonymised customer data is used anywhere, and no
identifier resembles a real account number, NRIC or card number. SENTINEL AI is a functional prototype of a
control, with the security posture of a prototype.

SENTINEL AI is a real-time fraud operations control tower for retail banking: **Detect. Explain. Intervene.
Investigate.** It implements Singapore's rapid account-draining safeguard (protected balance S$50,000; a
transaction that, with the previous 24 hours of outflows, moves more than 50% of the balance is held) as a
deterministic policy gate, and uses Gemini on Vertex AI to explain decisions that the rules have already made.

**Rules decide. AI explains. Humans authorize.** No language model sits in the path of a financial decision.

Built for the AI Builder Cup 2026, theme **BFSI — Intelligent Risk, Fraud & Financial Experiences**. Designed as
a multi-tenant platform; demonstrated as a single deployment on synthetic data.

**Live application:** <https://sentinal-ai.cloud.run> — the investigation workspace is at
<https://sentinal-ai.cloud.run/investigations>. This is the only public address; the generated Cloud Run UI
addresses redirect to it.

## Status

Deployed on Cloud Run (asia-southeast1) from Cloud Build on every push to `main`. The deterministic control path,
the SG-RD-50 gate with its hold cascade, the live stream, the Control Tower, Alerts & Cases and the investigation
workspace with Gemini on Vertex AI (`gemini-3.5-flash`, explanation and case summary) are working. The entity-graph
screen and the case report are not built yet.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Angular 22 (standalone, zoneless), NgRx, Signals, RxJS, Web Workers |
| Backend | Node.js 24 LTS, TypeScript 6, Express 5 on Cloud Run |
| Data | MongoDB Atlas on Google Cloud (`asia-southeast1`) |
| Messaging | Google Cloud Pub/Sub (ordered per account token) |
| Real time | WebSocket gateway on Cloud Run, fed by MongoDB change streams |
| AI | Gemini on Vertex AI, called only from `sentinel-core` with the service account's own credentials |
| CI/CD | Cloud Build → Artifact Registry → Cloud Run |

There are no API keys in this repository. Vertex AI is called with the service account's credentials; the only
secret (the Atlas connection string) lives in Secret Manager.

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
