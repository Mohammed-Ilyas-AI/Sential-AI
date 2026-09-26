# sentinel-transaction-events

| Property | Value |
|---|---|
| Message | `TransactionEvent` (schemaVersion 1.0), JSON |
| Publisher | `sentinel-simulator` (`roles/pubsub.publisher` on this topic only) |
| Ordering key | `sourceAccountToken` — the drain arithmetic is order-dependent |
| Region | `asia-southeast1` (message storage policy) |
| Carries | AUTHORISED, SETTLED, REVERSED, CANCELLED after the decision; the PENDING state is written synchronously by the decision API |
