# Competition checklist — AI Builder Cup 2026, BFSI

Theme: **BFSI — Intelligent Risk, Fraud & Financial Experiences.** Deadline 18 Oct 2026; freeze 15 Oct.

| Requirement | How the repository satisfies it | Status |
|---|---|---|
| Built on Google Cloud; deployed on Cloud Run | `infra/cloud-run/`, `infra/cloud-build/cloudbuild.yaml`, region `asia-southeast1` | Deployed |
| Meaningful use of Google AI | Gemini (Gemini API or Vertex AI) behind one gateway: score explanation, grounded case summary, and a function-calling investigation agent with read-only tools (ADR-010) | Built; live once `gemini-api-key` is stored |
| Agentic AI | Investigation agent: Gemini chooses which evidence to read over bounded turns, then files findings validated against what it read | Built |
| Working prototype, public working link | `sentinel-ui` public Cloud Run URL | Deployed |
| Public GitHub repository, README runs from a clean clone | `README.md` quick start | Repository local only |
| Video under 3 minutes, ten scenes | M§6 | Not started |
| Proposal PDF / deck | From the Master Document; separates "demonstrated" from "designed" | Not started |
| All submitted material in English | Code, comments, docs, README | Ongoing check |
| Fresh project inside the build window | First commit 21 Sep 2026; window 7 Sep – 18 Oct | Satisfied |
| No real personal data | Synthetic identifiers only; README first paragraph | Satisfied |
| COSMIC / SRF / platform wording | `fixed-wording.md` | Ongoing check |

## Verified absent

React, Firestore, Cloud SQL, SQLite, BigQuery, GKE, extra microservices, real bank APIs, COSMIC integration,
real PII, API keys or credentials in the repository, service-account key files. (The one Gemini API key lives in
Secret Manager only.)
