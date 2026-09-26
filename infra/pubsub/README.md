# Pub/Sub

One topic carries canonical `TransactionEvent` lifecycle events **after** the pre-transaction decision
(ADR-004). Nothing here has been created; run these once, deliberately, against `sentinel-ai-prod`.

## Topic

`topics/` — `sentinel-transaction-events`, published by `sentinel-simulator` with message ordering keyed
by `sourceAccountToken`.

```bash
gcloud pubsub topics create sentinel-transaction-events \
  --message-storage-policy-allowed-regions=asia-southeast1
```

## Subscription

`subscriptions/` — a push subscription to `sentinel-core`, ordered, authenticated with a dedicated
push service account.

```bash
gcloud pubsub subscriptions create sentinel-core-transaction-events \
  --topic=sentinel-transaction-events \
  --push-endpoint="${CORE_URL}/internal/pubsub/transaction-events" \
  --push-auth-service-account="sentinel-pubsub-push@${PROJECT_ID}.iam.gserviceaccount.com" \
  --enable-message-ordering \
  --ack-deadline=30
```

## Not built

A dead-letter topic and replay are production concerns (T§14, C§12): described in the proposal, not
deployed. Deduplication (unique `idempotencyKey`) and per-account ordering are built.
