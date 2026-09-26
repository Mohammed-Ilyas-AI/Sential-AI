# ADR-002 — NgRx for cross-route domain state, Signals for local state, RxJS for streams

- **Status:** Accepted, 26 Sep 2026 (resolves T§12 open decision #1)

## Context

T§5 assigns three tools three jobs; T§12 left open whether to drop NgRx for a signal store.

## Decision

| Tool | Owns | Rule of thumb |
|---|---|---|
| RxJS | Streams in motion: the WebSocket feed, 250 ms buffering, worker round-trips | If it arrives over time |
| NgRx (`@ngrx/store` 22, `createFeature`) | Domain state read across routes: alerts, transactions, interventions, session | If it survives a route change and another feature reads it |
| Signals | Local UI state: selected node, open panel, filter chips | If it dies with the component |

- Cross-route slices live in `apps/ui/src/app/state/`. Feature-local slices (investigations, cases) live in the
  feature's `state/` and are provided on the feature route.
- One NgRx action per worker batch, never per transaction.
- Pages read through feature facades (`data-access/`), never directly from the store.

## Consequences

`@ngrx/effects` and `@ngrx/signals` are not installed until a feature needs them.
