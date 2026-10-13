# ADR-001 — Angular 22 replaces Angular 20 as the frontend baseline

- **Status:** Accepted, 26 Sep 2026
- **Type:** Implementation amendment to the v1.2 baseline. The v1.2 PDFs are historical and are not rewritten.

## Context

The v1.2 documents (M§1, T§5, C§1) specify Angular 20. The implementation starts on 26 Sep 2026, when
Angular 22 is the actively supported major and Angular 20 is in long-term support. Starting a new codebase on
an LTS major buys nothing and forfeits current defaults.

Registry facts verified on 26 Sep 2026:

| Package | Version | Constraint it imposes |
|---|---|---|
| `@angular/core`, `@angular/cli`, `@angular/build` | 22.2.0 | Node `^22.22.3 \|\| ^24.15.0 \|\| >=26`; TypeScript `>=6.0 <6.1` |
| `@ngrx/store` | 22.0.1 | `@angular/core ^22` |
| `rxjs` | 7.8.2 | Angular peer `^6.5.3 \|\| ^7.4.0` |
| `vitest` | 5.0.2 | Supported by `@angular/build:unit-test` |

Every Angular 22.x release requires **TypeScript 6.0.x**, not 5.9. `typescript@latest` is 7.x and must never be
installed.

## Decision

| Concern | Baseline |
|---|---|
| Framework | Angular `~22.2.0`, standalone components only, no NgModules, zoneless change detection |
| Language | TypeScript `~6.0.3` across every workspace |
| Runtime | Node.js 24 LTS: `24.18.0` in `.nvmrc`, Docker images and Cloud Build; `engines` accepts 24.x under `.npmrc` `engine-strict` |
| Streams / state | RxJS `~7.8.2`, NgRx `~22.0.1`, Angular Signals |
| Tests | Vitest `~5.0.2` everywhere (the Angular unit-test builder runs Vitest for `apps/ui`) |

Unchanged from v1.2: every architectural decision, the four planes, the control/intelligence separation,
MongoDB Atlas, Pub/Sub, Cloud Run, Vertex AI and the scope.

## Consequences

- The scaffold's Karma/Jasmine and `node --test` are replaced by Vitest.
- Local development uses Node 24 (amended 13 Oct 2026: moved from 22.23.3 to the LTS the team develops on); other majors are rejected by `engine-strict`.
- "Module" in this codebase means a feature or capability boundary, never an Angular `NgModule`.
- Angular 22.2.0 was released on 23 Sep 2026; the lockfile pins it until the 15 Oct freeze.
