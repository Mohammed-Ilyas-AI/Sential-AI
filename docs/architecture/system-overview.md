# System overview

## The loop

**Detect → Explain → Intervene → Investigate → Report.** Rules decide. AI explains. Humans authorize.

## Two paths that meet only at the analyst's screen

```text
CONTROL PATH (synchronous, deterministic, no AI; under 500 ms to a rendered row)
  POST /v1/decision/transactions
  → rolling window (transactions.effectiveAmount)
  → drain gate SG-RD-50 (separate code path; decides)
  → risk assessment (7 rules; advisory score = sum of contributions)
  → DecisionResponse ALLOW / HOLD / REJECT → decisions, assessments, interventions, alerts
  → change stream → sentinel-stream → WebSocket → UI

INTELLIGENCE PATH (asynchronous, best-effort)
  analyst request → EvidenceBundle → ModelRouter → Gemini (Gemini API or Vertex AI)
  → response-schema validation → sourceField validation → UI

INVESTIGATION AGENT (intelligence path, ADR-010)
  analyst "Run agent" → Gemini function calling over read-only evidence tools (≤5 turns)
  → submit_findings → schema validation → sourceField must cite evidence the agent retrieved → trace + findings → UI
```

If Gemini is slow or down, decisions, holds and the audit trail continue; the analyst loses the narrative, not
the protection.

## Runtime planes (prototype)

| Plane | Deployable | Runtime |
|---|---|---|
| Ingest | `sentinel-simulator` | Cloud Run Job → decision API, then Pub/Sub |
| Compute | `sentinel-core` | Cloud Run service, MongoDB Atlas |
| Intelligence | `sentinel-core` (separate modules and composition root) | Gemini via the Gemini API or Vertex AI |
| Presentation | `sentinel-stream`, `sentinel-ui` | WebSocket gateway, Angular 22 SPA |

## Production direction (described, not built)

Four planes around today's core — SENTINEL Edge, control plane, network intelligence plane, analyst
experience plane (M§13, T§13–14). Only three seams are built now: the decision API, the canonical event
envelope, and edge provenance. Fixed wording: "Designed as a multi-tenant platform; demonstrated as a single
deployment on synthetic data."
