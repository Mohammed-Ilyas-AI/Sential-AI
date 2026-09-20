# Rapid-drain control

## Why it exists

Singapore's Shared Responsibility Framework expects a bank to notice when a customer's
account is being emptied quickly and to do something before it is. A control that only
reports after the fact does not discharge the duty.

## The control

A breach is: **within a rolling window, outflows from an account exceed a given percentage
of the balance at the window's start, and the total exceeds a floor amount.**

The floor keeps small accounts from tripping the control on ordinary spending.

Default configuration (illustrative, set in `.env`):

| Setting | Default |
|---|---|
| `RAPID_DRAIN_WINDOW_MINUTES` | 60 |
| `RAPID_DRAIN_BALANCE_PCT` | 50 |
| `RAPID_DRAIN_MIN_AMOUNT_SGD` | 1000 |

## On breach

1. The triggering transaction is held, not rejected.
2. A customer verification challenge fires on the registered channel.
3. A case opens with band `critical` and lands at the top of the analyst queue.
4. The decision, the thresholds in force, and the timestamps are written to the audit
   trail — the thresholds are recorded with the decision so a later config change cannot
   rewrite the past.

## Deliberate non-goals

- The control does not consider the risk score. It is a policy floor, not a smarter
  detector; a low-scoring drain is still a drain.
- It does not auto-reject. A held payment that turns out to be legitimate is an
  inconvenience; a rejected one is a complaint.
