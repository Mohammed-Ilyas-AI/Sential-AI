# CLAUDE.md

Working notes for Claude Code on this repository.

## Project

SENTINEL AI — a real-time fraud operations control tower for retail banking.
Competition entry for AI Builder Cup 2026 (BFSI theme). Prototype deadline **18 Oct 2026**.

## Repository shape

npm workspaces monorepo.

- `apps/web` — Angular 20. Standalone components only, signals for state, no NgModules.
- `apps/api` — Node.js 22 + TypeScript, Express, ESM. Deploys to Cloud Run.
- `packages/shared` — domain types (`Transaction`, `RiskSignal`, `RiskAssessment`, `Case`).
  Both apps import from `@sentinel/shared`. Domain types live here, nowhere else.

## Conventions

- TypeScript strict everywhere. No `any`; use `unknown` and narrow.
- API routes stay thin — validation in `middleware`, logic in `services`.
- Nothing reaches Vertex AI outside `apps/api/src/services/` — the web app never holds a
  model credential.
- Money is handled in minor units (cents) as integers, never floats. Currency is explicit
  on every amount.
- Commit style: conventional commits (`feat:`, `fix:`, `docs:`, `chore:`).

## Commands

```bash
npm run dev         # web + api together
npm run build       # all workspaces
npm run test        # all workspaces
npm run typecheck   # all workspaces
```

## Guardrails

- Never commit `.env`, service-account JSON, or any real customer data.
- All transaction data used in development is synthetic. If a fixture looks like a real
  account number, it is wrong.
- The rapid-drain thresholds in `.env.example` are illustrative, not the bank's policy —
  they are configuration, never hardcoded into detection code.
