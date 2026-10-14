# ADR-008 — The SG-RD-50 hold cascade

- **Status:** Accepted, 13 Oct 2026
- **Implements:** T§4 ("the transaction and all subsequent outflows on that account enter the hold state"),
  M§2 ("hold the transaction and subsequent outflows for 24 hours"), M§5.3 (kill-switch behaviour).

## Context

The documents require the cascade but do not say when it ends, what a cascaded hold's cooling period is, or
how it interacts with the exceptions an analyst works. Before this ADR, a later outflow was held only if the
drain arithmetic happened to cross 50% again, so the control silently lapsed once the earlier outflows left the
rolling window, or once the bank cancelled the triggering transfer.

## Decision

1. **Trigger.** A transfer that meets the threshold is held under `SG-RD-50_THRESHOLD_EXCEEDED` with its own
   24-hour cooling period (unchanged).
2. **Cascade.** While a trigger is in force, every later *eligible* outflow on the account is held under
   `SG-RD-50_HOLD_CASCADE`, whatever the drain arithmetic says. Its decision and its intervention record the
   trigger in `cascadeOfTransactionId`, and it shares the trigger's `holdUntil`: one cooling period per account.
3. **Exclusions.** Standing instructions, GIRO/eGIRO and bills to designated billing organisations stay outside
   the cascade exactly as they stay outside the gate.
4. **Event ordering.** Only outflows that occurred at or after the trigger's own `occurredAt` are cascaded; a
   late-arriving earlier event is never reached back to.
5. **End.** The cascade ends when the trigger's cooling period ends, or when the trigger is released after
   customer verification. A customer cancellation or an analyst fraud confirmation does **not** end it: neither
   shows the account is safe. Holds already placed stay until each is resolved or auto-released.
6. **Extension.** Only a new threshold breach starts a new trigger (and a new cooling period). Cascaded holds
   never extend the cascade.
7. **Score.** The cascade changes the decision and its reason code only. The assessment, `contributions[]` and
   the score are exactly what they would be without it.

## Consequences

- The "account in hold state" shown on Alerts & Cases is the cascade, not a UI invention (T§4).
- An analyst-initiated kill switch (holding all outflows on request, without a breach) is **not** built; the
  cascade is the automatic form of it. That remains an MVP gap.
- Idempotency is unchanged: a retried decision returns the stored record and appends no second hold.
