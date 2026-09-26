# sentinel-core-transaction-events

| Property | Value |
|---|---|
| Type | Push, message ordering enabled |
| Endpoint | `POST /internal/pubsub/transaction-events` on sentinel-core |
| Authentication | OIDC token from `sentinel-pubsub-push` (`roles/run.invoker` on sentinel-core); verification is implemented with the consumer (build order step 3) |
| Handler | Appends to `transaction_events`, updates the `transactions` projection. Never scores. |
| Duplicates | Absorbed by the unique `idempotencyKey` index |
