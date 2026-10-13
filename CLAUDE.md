# CLAUDE.md

Working notes for Claude Code on this repository.

## Project

SENTINEL AI — a real-time fraud operations control tower for retail banking. Competition entry for AI Builder
Cup 2026 (BFSI theme). Freeze **15 Oct 2026**, submission **18 Oct 2026**.

Source of truth: the three v1.2 documents (Master, Technical, Toolchain & Competition Compliance) plus the
amendments in `docs/decisions/`. `docs/repository-architecture.md` maps them onto this repository.

**Rules decide. AI explains. Humans authorize.** The policy gate never calls a language model, and the language
model never returns a decision. A change that breaks this is the wrong change, whatever it adds.

## Repository shape

npm workspaces, Node **24 LTS** (24.18.0 in `.nvmrc`; `engines` accepts 24.x, `engine-strict`), TypeScript **6.0.x**, Vitest **5**.

- `apps/ui` — Angular 22.2, standalone, zoneless, OnPush. Feature-oriented: `features/<feature>/{pages,components,data-access,state,models,routes.ts,index.ts}`. NgRx for cross-route domain state, Signals for local UI state, RxJS for streams.
- `apps/core` — Express 5, ESM. `modules/<capability>/{application,presentation}`; ports in `application/ports/`; adapters in `infrastructure/`; wiring only in `composition/`.
- `apps/stream` — WebSocket gateway. Transport only.
- `apps/simulator` — Cloud Run Job playing the bank's payment orchestrator.
- `packages/domain` — every shared contract and documented constant. Zero dependencies. Domain types live here, nowhere else.
- `packages/rules` — the seven pure rules, risk engine and drain gate. Depends on domain only; no I/O.
- `packages/scenarios` — seeded, deterministic generators and `DEMO_TAKEOVER_01`. No `Math.random`.

## Conventions

- TypeScript strict everywhere. No `any`; use `unknown` and narrow.
- Controllers are thin: validation in middleware, orchestration in application services, persistence behind ports.
- Nothing reaches Vertex AI outside `apps/core/src/infrastructure/ai/`; the browser never holds a model identifier
  or credential. Model IDs are configuration, never literals.
- Money is integer minor units (SGD cents), never floats. Time is UTC ISO 8601 on the wire.
- `contributions[]` is immutable and is the score; `interventions` is append-only; lifecycle events count once.
- Do not invent rule scoring curves: they are ported from the original HTML behavioural reference.
- Import boundaries are enforced by `eslint.config.js` (`sentinel/import-boundaries`); fix the design, not the rule.
- No `utils.ts`, `helpers.ts`, `common.ts`, god services or generic managers.
- Commit style: conventional commits (`feat:`, `fix:`, `docs:`, `chore:`).

## Commands

```bash
npm run dev             # core + stream + ui
npm run typecheck       # all workspaces
npm run lint            # eslint incl. architecture boundaries
npm test                # all workspaces (Vitest; ng test for the UI)
npm run test:scenario   # DEMO_TAKEOVER_01 through the control path
npm run build           # packages, Node apps, Angular
npm run verify          # all of the above
```

## Guardrails

- Never commit `.env`, service-account JSON, connection strings or any real customer data.
- All data is synthetic. If a fixture looks like a real account number, NRIC or card number, it is wrong.
- Rapid-drain thresholds are configuration (defaults in `packages/domain`, SG-RD-1.0). Changing one requires a new
  policy version.
- Use the fixed wording in `docs/compliance/fixed-wording.md` verbatim; never claim COSMIC or real bank integration.
- Stay inside the eight MVP modules and the not-building list (M§7).
