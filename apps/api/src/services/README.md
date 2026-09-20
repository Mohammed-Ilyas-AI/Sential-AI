# Services

Business logic lives here; routes stay thin.

- `rules/` — deterministic risk signals. Each rule emits a `RiskSignal` with a weight and
  a plain-language reason. Rules are data, not code branches.
- `policy/` — the rapid-drain control and any future obligations. Reads thresholds from
  `config/env.ts`; never hardcodes them.
- `explanation/` — the only place that talks to Vertex AI. The prompt carries the signals
  that fired; the model summarises evidence, it does not supply evidence.
- `graph/` — entity adjacency (accounts, devices, payees), walked to bounded depth.
