# ADR-003 — MongoDB Atlas is the only operational database

- **Status:** Accepted (v1.2 decision, recorded for the codebase)

## Decision

MongoDB Atlas on Google Cloud, `asia-southeast1`, M0 upgrading to M10 only if change streams or connection
limits force it. No Firestore, Cloud SQL, SQLite or BigQuery (C§3).

Why it fits (C§6): the evidence bundle is a nested document (one read, not eight joins); change streams replace a
second message bus; the 24-hour window is one aggregation against the store the control path already reads.

## The eleven collections

| Collection | Holds | Invariant |
|---|---|---|
| `accounts` | Hot state, cached window, known devices and payees | |
| `transaction_events` | Every lifecycle event | Immutable; unique `idempotencyKey` |
| `transactions` | One document per `transactionId` | Projection; drain reads `effectiveAmount` only |
| `security_events` | `AccountSecurityEvent` log | Unique `idempotencyKey` |
| `decisions` | `DecisionResponse` records | Unique `idempotencyKey`; primary live-tape source |
| `assessments` | `RiskAssessment` with `contributions[]` | Insert-only; contributions never modified |
| `interventions` | Audit log | Append-only |
| `alerts` | Open alert queue | |
| `cases` | Investigation state, Gemini output | |
| `entities` | Graph nodes | Tokens only |
| `entity_edges` | Graph edges with `EdgeEvidence` | |

## Boundary

Application code never sees MongoDB. Modules declare ports (`*.port.ts`); adapters live in
`apps/core/src/infrastructure/database/mongodb/repositories/` and are constructed only in
`apps/core/src/composition/`. Append-only is structural: `InterventionRepository` and `AssessmentRepository`
expose no update methods.

## Consequences

- "Append-only" in MongoDB is an application promise; the immutable archive tier is production-only (T§14).
- C§6 mentions a TTL on demo transactions. It is not applied: a TTL would silently shrink the drain window and
  the audit trail.
