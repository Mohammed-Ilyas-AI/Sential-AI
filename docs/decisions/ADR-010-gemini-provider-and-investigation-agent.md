# ADR-010 — Gemini API provider and the investigation agent

- **Status:** Accepted, 14 Oct 2026
- **Amends:** T§6 and C§"How Gemini is called" ("Vertex AI with the service account's credentials, no API keys"),
  T§7 (two tiers, structured output) and M§5.4 ("Gemini investigation agent").

## Context

The competition requires submissions to "leverage Google AI models (like Gemini or Gemma) or be built using
agentic platforms", deployed on Cloud Run or Firebase, and gives Technical Merit & GenAI Implementation 40% of the
score. Two gaps remained:

1. The deployed `sentinel-core` had no model IDs set, so every advisory answered `MODEL_NOT_CONFIGURED`. The team
   chose to run Gemini through the Gemini API with a key, alongside the Vertex AI path.
2. The Master Document promises a "Gemini investigation agent", but every model call was a single structured
   request. Nothing planned, called tools or decided when it had enough evidence.

## Decision

**Provider.** `sentinel-core` reaches Gemini through one of two endpoints that share a single gateway
(`infrastructure/ai/gemini/`):

| `GEMINI_PROVIDER` | Endpoint | Credential |
|---|---|---|
| `gemini-api` (deployed default) | `generativelanguage.googleapis.com/v1beta` | `GEMINI_API_KEY`, from the Secret Manager secret `gemini-api-key`, readable only by the `sentinel-core` service account |
| `vertex-ai` | `<region>-aiplatform.googleapis.com/v1` | the `sentinel-core` service account (application default credentials) |

When `GEMINI_PROVIDER` is unset, the presence of a key selects the Gemini API. The key travels only in the
`x-goog-api-key` header, never in a URL. It never reaches the browser, a log line, the repository or a
build substitution. A missing key or model is not a startup error: the advisory reports `MODEL_NOT_CONFIGURED`
and the control path runs unchanged. The Cloud Run manifest references the secret only when
`GEMINI_PROVIDER=gemini-api`, so a Vertex AI deployment never needs the secret to exist.

**Investigation agent.** `POST /v1/investigations/{assessmentId}/agent-investigation` runs a bounded agent loop
using Gemini function calling (`InvestigationAgentService`, application layer):

- **Tools.** Ten read-only evidence tools, each reading one section of the evidence bundle already compiled for
  that assessment (`AGENT_TOOL_BUNDLE_FIELD`), plus the terminal `submit_findings`, whose parameters are the
  `CaseSummary` schema. No tool can reach another account, write anything, or touch a score, a decision or a
  hold. An unknown tool name gets an error response and is not executed.
- **Bounds.** At most `AGENT_MAX_TOOL_ROUNDS` (5) evidence-gathering turns and `AGENT_MAX_CALLS_PER_ROUND` (4)
  calls per turn. Function-calling mode is `ANY`, so the agent never answers in free text. The final turn may
  only call `submit_findings`. One run is capped at `AGENT_INVESTIGATION_DEADLINE_MS` (90 s), and each turn
  gets the deep-tier ceiling (15 s). The agent runs as the deep-tier job `EVIDENCE_CORRELATION`.
- **Guardrails, all in the application layer so they survive a provider change.** The findings pass the same
  `ResponseSchemaValidator` as the case summary, so a recommendation to release a held transfer is rejected.
  Every `sourceField` must name a field in a bundle section the agent **actually retrieved**, which is stricter
  than the case summary's "exists in the bundle". Rejected findings go back to the agent once as a tool error;
  a second failure is a `FALLBACK`.
- **Trace.** The outcome carries every tool call (turn, tool, arguments, bundle section, records returned),
  which the investigation workspace renders above the findings.
- **Gemini 3 protocol.** The model's reply is sent back verbatim on the next turn, so its thought signatures
  survive multi-turn function calling.

## Consequences

- "Rules decide. AI explains. Humans authorize." is unchanged: the agent lives on the intelligence path, the
  lint boundary still rejects any import of it from the control path, and it holds no write capability.
- The README and the Secret Manager README no longer claim there are no API keys. They now state where the one
  key lives, who can read it, and that it never leaves `sentinel-core`.
- A deploy with `_GEMINI_PROVIDER=gemini-api` fails at `gcloud run services replace` until `gemini-api-key`
  exists (`infra/cloud-build/scripts/store-gemini-api-key.sh`). The running revision keeps serving.
- Model IDs (`gemini-3.5-flash` fast, `gemini-3.1-pro-preview` deep) were verified on 14 Oct 2026 and remain
  configuration. If the agent's turns exceed the 15 s deep-tier ceiling during rehearsal, set
  `_GEMINI_DEEP_MODEL` to the fast model. That is a configuration change, not a code change.
