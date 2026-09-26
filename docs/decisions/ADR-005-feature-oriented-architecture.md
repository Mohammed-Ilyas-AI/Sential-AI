# ADR-005 — Feature-oriented structure, ports and adapters, machine-checked boundaries

- **Status:** Accepted, 26 Sep 2026

## Decision

**Frontend (`apps/ui`).** Organised by business capability, not technical type. Each feature owns `pages/`
(compose), `components/` (present), `data-access/` (facades and API), `state/` (feature-local NgRx), `models/`
(view models), `routes.ts` and a public `index.ts`. Only genuinely cross-feature code lives in `shared/`.
Features: `control-tower`, `live-transactions`, `fraud-alerts`, `investigations`, `network-analysis`, `cases`,
`demo-controls`.

**Backend (`apps/core`).** Modules by capability: `application/` (use-case interfaces, services, `ports/`) and
`presentation/` (controller, routes, request validator). Adapters are grouped by technology under
`infrastructure/`; the only code that constructs them is `composition/` (plus the process entry `main.ts`).

**Naming.** Angular: hyphenated names without type suffixes (`transaction-tape.ts`), except NgRx
(`alerts.feature.ts`) and pipes/interceptors (`…-pipe.ts`, `…-interceptor.ts`). Node and packages:
`capability.role.ts` (`decision.service.ts`, `decision-repository.port.ts`, `mongo-decision.repository.ts`).
Banned: `utils`, `helpers`, `common`, `misc`, `manager`.

**Enforcement.** `eslint.config.js` carries a local `sentinel` plugin:

| Rule | Enforces |
|---|---|
| `sentinel/import-boundaries` | Control path cannot import the intelligence path or AI SDKs; application cannot import infrastructure, composition or HTTP; SDKs confined to `infrastructure/`; `packages/domain` has zero dependencies; `packages/rules` and `packages/scenarios` depend only on domain; `apps/stream` imports no rules or AI SDKs; the browser imports no database, server or Google SDKs; no cross-feature deep imports; apps never import other apps |
| `sentinel/no-generic-module-names` | No `utils.ts` / `helpers.ts` / `common.ts` dumping grounds |

## Consequences

- Where to look is answered by capability: `features/investigations`, `modules/decision`.
- A new risk rule is one `*.rule.ts` plus one registry entry; no controller, repository or UI change.
- The boundary rules were verified by linting deliberate violations.
