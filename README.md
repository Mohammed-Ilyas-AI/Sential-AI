# SENTINEL AI

A real-time fraud operations control tower for retail banking. SENTINEL AI detects
suspicious transaction behaviour, explains the risk in analyst-readable language,
intervenes automatically when a rapid-drain policy threshold is breached, and helps
analysts investigate connected financial entities.

Built for the **AI Builder Cup 2026** (JAPAC), BFSI theme — *Intelligent Risk, Fraud &
Financial Experiences*.

## The problem

Singapore's Shared Responsibility Framework puts banks on the hook when a scam victim's
account is drained and the bank failed to act on the warning signs. The signs are usually
there — an unusual payee, an odd hour, a burst of transfers that empties half a balance in
under an hour — but they sit in separate systems and nobody joins them in time.

SENTINEL AI joins them in the transaction path, not after the fact.

## What it does

| Capability | Description |
|---|---|
| **Detect** | Streams transactions through a rules + model scoring pipeline, producing a risk score with contributing signals. |
| **Explain** | Gemini turns the score and its signals into a short, grounded narrative an analyst can act on. |
| **Intervene** | Breaching the rapid-drain threshold holds the transaction and triggers a customer verification step. |
| **Investigate** | An entity graph surfaces accounts, devices and payees connected to a flagged case. |

## Stack

- **Web** — Angular 20 (standalone components, signals), `apps/web`
- **API** — Node.js 22 + TypeScript on Cloud Run, `apps/api`
- **Shared** — domain types shared across web and API, `packages/shared`
- **Streaming** — Google Cloud Pub/Sub
- **AI** — Gemini on Vertex AI

## Layout

```
sentinel-ai/
├── apps/
│   ├── web/          Angular 20 control tower UI
│   └── api/          Node.js scoring, policy and case API
├── packages/
│   └── shared/       Domain types shared by web and api
├── docs/             Architecture, data model, policy notes
├── infra/            Cloud Run / Pub/Sub deployment notes
└── .github/workflows CI
```

## Getting started

```bash
nvm use                 # Node 22
npm install             # installs all workspaces
cp .env.example .env    # fill in GCP values
npm run dev             # web on :4200, api on :8080
```

## Docs

- [Product brief](docs/product-brief.md)
- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [Rapid-drain policy](docs/rapid-drain-policy.md)
- [Roadmap](docs/roadmap.md)

## Status

Scaffold. No detection logic implemented yet — see the roadmap for build order.
