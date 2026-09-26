# Domain contracts

All contracts live in `packages/domain/src/`, grouped by capability, and are imported as `@sentinel/domain`.
Shapes marked **v1.2** are transcribed from the Technical Document; shapes marked **provisional** fill a gap the
documents leave open and may change when their build step lands.

| Capability | Contracts | Source |
|---|---|---|
| `transaction/` | `Transaction`, `TransactionEvent`, `TransactionLifecycleStatus`, `TransactionProjection` | v1.2 (T§2); projection shape per T§2 v1.2 rules |
| `security-event/` | `AccountSecurityEvent` | v1.2 |
| `account/` | `Account` (v1.2), `AccountState` (v1.2 fields), `AccountProfile` (provisional) | T§2 |
| `risk/` | `RiskAssessment`, `Contribution`, `RiskBand`, `RollingWindow` + `WindowContext`, `RecordedRiskAssessment` | v1.2; window split so the gate reads the window before the drain state exists |
| `policy/` | `DrainState`, `RapidDrainPolicy`, `PolicyCode`, `DesignatedBillingOrganisations` | v1.2; policy as configuration |
| `decision/` | `Decision`, `DecisionRequest` (= PENDING `TransactionEvent`), `DecisionResponse` (v1.2), `DecisionRecord` | T§2, ADR-004 |
| `intervention/` | `Intervention` with the T§14 audit fields (`decisionId`, `previousState`, versions, assessment snapshot) | T§2 + T§14 |
| `alert/` | `Alert`, `AlertSummary` | provisional |
| `case/` | `Case`, `CaseStatus` | v1.2 |
| `intelligence/` | `EvidenceBundle` (v1.2), `CaseSummary` (v1.2), `RiskExplanation`, `ModelJob` + `MODEL_JOB_TIER`, `DeviceEvent`/`PayeeEvent` (provisional) | T§7, M§8.1 |
| `graph/` | `GraphNode`, `GraphEdge` (+ `evidence`), `EdgeEvidence`, `GraphNeighbourhood`, `FundTrace` + `TraceObservability` | v1.2; T§13 observability |
| `realtime/` | `StreamMessage`, `StreamClientMessage`, `AccountSnapshot` | provisional |
| `tenant/` | `TenantId`, `InstitutionId`, `TenantConfig` (production contract, stretch lens only) | T§14 |
| `constants/` | Policy, risk weights and bands, caps, latency budgets, `DEMO_TAKEOVER_01`, synthetic network | M§3, T§3, T§9, T§10 |

## Rules that hold everywhere

- Money is integer minor units (`MinorUnits`), SGD. `PROTECTED_BALANCE_MINOR = 5_000_000`.
- Time is UTC ISO 8601 on the wire (`IsoTimestamp`), localised only at render.
- `contributions[]` is the single source of truth for the score; the score is the sum of `points`.
- Identifier fields carry tokens. In the prototype, `Transaction.*Id` hold the tokens from `TransactionEvent`;
  the token → display-ID mapping (`ACC-10291`) lives only in the simulator, standing in for the bank's vault.
- Documented rule parameters are constants; the scaling curves between them come from the HTML behavioural
  reference and are not yet encoded.
