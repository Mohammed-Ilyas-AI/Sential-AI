# Data model

All types live in `packages/shared/src` and are imported as `@sentinel/shared`.

## Money

Amounts are integers in minor units with an explicit currency. No floats anywhere.

```ts
interface Money { amountMinor: number; currency: 'SGD' | 'USD' | 'INR'; }
```

## Transaction

The unit of work. Immutable once ingested.

| Field | Notes |
|---|---|
| `id` | ULID, assigned at ingest |
| `accountId` | originating account |
| `payee` | `{ id, name, isNew, countryCode }` |
| `amount` | `Money` |
| `channel` | `web` \| `mobile` \| `atm` \| `branch` |
| `deviceId` | null for non-digital channels |
| `occurredAt` | ISO 8601, source clock |
| `receivedAt` | ISO 8601, our clock |

## RiskSignal

One rule firing. Carries its own reason so the UI never has to map an ID to English.

| Field | Notes |
|---|---|
| `code` | e.g. `NEW_PAYEE_HIGH_VALUE` |
| `weight` | 0–100 contribution |
| `reason` | analyst-readable sentence |
| `evidence` | the values the rule looked at |

## RiskAssessment

| Field | Notes |
|---|---|
| `transactionId` | |
| `score` | 0–100 |
| `band` | `low` \| `elevated` \| `high` \| `critical` |
| `signals` | `RiskSignal[]` |
| `explanation` | Gemini narrative, nullable while generating |
| `assessedAt` | |

## PolicyDecision

Kept separate from the assessment — see architecture notes.

| Field | Notes |
|---|---|
| `transactionId` | |
| `control` | e.g. `RAPID_DRAIN` |
| `outcome` | `allow` \| `hold` \| `challenge` |
| `thresholds` | the config values in force at decision time |
| `decidedAt` | |

## Case

An analyst's unit of work: one or more transactions, the assessments, the policy
decisions, the entity graph snapshot, and an audit trail of every action taken.
