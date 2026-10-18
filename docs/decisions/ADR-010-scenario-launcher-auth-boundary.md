# ADR-010: Defer the browser scenario launcher until an authenticated server boundary exists

- Status: accepted blocker
- Date: 2026-10-18

## Context

The simulator can run `DEMO_TAKEOVER_01` through its existing local or Cloud Run Job entrypoint. The core API has
no authenticated operator principal, no configured Cloud Run Job identity/name/region, and no persisted
scenario-run status service. `x-sentinel-lens` is a projection hint, not authentication.

## Decision

Do not expose a browser endpoint that invokes a Cloud Run Job. It would be callable without operator
authorization and could create unbounded executions. The UI states that launch is unavailable; it does not
pretend to start a run. The deterministic simulator remains runnable through its configured entrypoint.

The launcher can be enabled after the platform supplies an authenticated operator identity, server-side job
configuration/credentials, an idempotent run repository, and truthful execution-status polling. No cloud resource,
credential, or Gemini setting is changed by this decision.
