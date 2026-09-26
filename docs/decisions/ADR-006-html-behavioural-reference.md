# ADR-006 — The HTML behavioural reference is the source of the rule curves and demo inputs

- **Status:** Accepted, 26 Sep 2026

## Context

The v1.2 documents fix the seven rule codes, their maxima, the bands, the SG-RD-50 gate and the demo outcome
(ACC-10291, S$52,000 opening balance, S$34,000 moved, 65.4% drain, 24h hold, 95 CRITICAL). They do not give the
scoring curves between zero and each maximum, nor the per-step inputs that produce the 37 → 49 → 75 → 95 ladder.
Inventing curves to hit 95 would make the headline number an artefact of our tuning.

## Decision

`docs/reference/sentinel-ai-prototype.html` (the original prototype, copied verbatim) is adopted as the
behavioural reference. The rules port its curves exactly and nothing is left provisional:

| Rule | Curve (clamped) | Max |
|---|---|---|
| `RAPID_DRAIN` | `round((drain% − 25) / 25 × 30)`, protected accounts only | 30 |
| `VELOCITY` | `round((ratio − 3) × 6)` | 12 |
| `BEHAVIOUR_DEV` | `round((amount − p95) / p95 × 7)` | 7 |
| `ENTITY_LINK` | 3 per confirmed link, 2 per strong, within two hops, weakest link on the path | 9 |
| `NEW_DEVICE` | 21 if first seen under 24h | 21 |
| `NEW_PAYEE` | 16 under 24h, 8 under 168h | 16 |
| `COOLING_OFF` | 5 while active | 5 |

`DEMO_TAKEOVER_01` adopts the reference's inputs (velocity ratios 1.8, 3.5, 4.5, 5.5; amount p95 S$3,000; the
flagged links around PAYEE-7742). Velocity ratio and p95 are bank-reported account behaviour
(`PUT /v1/accounts/:accountToken`), not values the rules derive. The Control Tower's drain meter colours are the
reference's (amber above 35%, red above the gate line).

## Consequences

- `DEMO_TAKEOVER_01` through the real control path must produce 37/49/75/95 and exactly one HOLD; the scenario
  test asserts it.
- A change to any curve is a change to the ruleset version and must be checked against the reference.
