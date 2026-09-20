# Infrastructure

Target: Google Cloud, region `asia-southeast1` (Singapore) — the scenario is Singapore's
Shared Responsibility Framework, so data stays in region.

## Components

| Component | Service |
|---|---|
| API | Cloud Run (`apps/api/Dockerfile`) |
| Transaction stream | Pub/Sub topic `sentinel-transactions` |
| Explanations | Vertex AI (Gemini) |
| Web | Cloud Run or static hosting, built from `apps/web` |

## One-time setup

```bash
gcloud config set project "$GCP_PROJECT_ID"
gcloud services enable run.googleapis.com pubsub.googleapis.com aiplatform.googleapis.com
gcloud pubsub topics create sentinel-transactions
gcloud pubsub subscriptions create sentinel-scoring-sub --topic sentinel-transactions
```

## Deploy the API

```bash
gcloud run deploy sentinel-api \
  --source . \
  --region "$GCP_REGION" \
  --allow-unauthenticated=false \
  --set-env-vars "GCP_PROJECT_ID=$GCP_PROJECT_ID,VERTEX_LOCATION=$GCP_REGION"
```

## Notes

- The Cloud Run service account needs `roles/aiplatform.user` and `roles/pubsub.subscriber`.
- No service-account key files. Use workload identity; nothing credential-shaped belongs
  in this repo.
