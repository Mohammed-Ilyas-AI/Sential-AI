# ADR-007 — Node.js 24 LTS replaces Node.js 22 as the runtime

- **Status:** Accepted, 13 Oct 2026
- **Amends:** Toolchain & Competition Compliance v1.2 (stack table: "Node.js 22, Express"; tooling table: "Node 22
  locally"). Every other statement in the v1.2 documents is unchanged.

## Context

The v1.2 Toolchain document names Node.js 22. The repository was scaffolded and verified on Node.js 24 LTS
(24.18.0), and the Angular 22.2 / TypeScript 6.0 / Vitest 5 toolchain is supported on it. Two runtimes in
one repository (22 in the document, 24 on the machines) is the kind of drift that breaks a build on the day:
`engine-strict=true` makes npm refuse a mismatched Node, and a container built on one major while CI tests on
another is not the system that was tested.

The owner decided to keep Node.js 24 and record the amendment rather than downgrade.

## Decision

Node.js **24 LTS, pinned to 24.18.0**, is the single runtime for local development, tests, Cloud Build and
every Cloud Run image.

| Place | Value | Enforced by |
|---|---|---|
| `.nvmrc` | `24.18.0` | nvm / fnm |
| root `package.json` `engines.node` | `>=24.0.0 <25.0.0` | `.npmrc` `engine-strict=true` |
| `package-lock.json` (root package) | `engines.node` `>=24.0.0 <25.0.0` | `npm ci` |
| `@types/node` (core, stream, simulator) | `~24.19.0` (no 24.18.x types release exists) | lockfile |
| `infra/cloud-build/cloudbuild.yaml` | every Node step `node:24.18.0-slim` | Cloud Build |
| `infra/cloud-run/sentinel-core/Dockerfile` | build and runtime `node:24.18.0-slim` | image |
| `infra/cloud-run/sentinel-stream/Dockerfile` | build and runtime `node:24.18.0-slim` | image |
| `infra/cloud-run/sentinel-simulator/Dockerfile` | build and runtime `node:24.18.0-slim` | image |
| `infra/cloud-run/sentinel-ui/Dockerfile` | build `node:24.18.0-slim`; runtime is nginx (no Node) | image |
| `npm run doctor` | fails unless the running Node major is 24 | `tools/local-dev/doctor.mjs` |

There is no GitHub Actions workflow; Cloud Build is the CI.

## Consequences

- A contributor on Node 22 gets a hard `EBADENGINE` from npm instead of a subtle runtime difference.
- Upgrading within 24.x means changing `.nvmrc`, the five Docker/Cloud Build references and this table
  together. Moving to another major needs a new ADR.
- `@types/node` was moved from 22.20.4 to 24.19.0 so the Node APIs the type checker allows are the ones the
  runtime has.
- On Windows, `npm install` while a dev server holds `esbuild.exe` open can drop every platform-specific
  optional package from `package-lock.json`. Stop the dev servers before installing, and check that a lockfile
  diff contains only the intended entries before committing it.
