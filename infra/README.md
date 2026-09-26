# Infrastructure

One GCP project, `sentinel-ai-prod`, in `asia-southeast1` (Singapore). No Terraform and no GKE: four
containers do not need an orchestrator. **Nothing in this folder has been run and no cloud resource exists
yet.**

| Folder | Holds |
|---|---|
| `cloud-run/` | One folder per deployable: Dockerfile plus Cloud Run manifest (`service.yaml` or `job.yaml`) |
| `pubsub/` | The transaction-event topic and the ordered push subscription |
| `mongodb/` | Atlas provisioning runbook (collections and indexes live in code) |
| `secret-manager/` | The single secret, `mongodb-uri` |
| `cloud-build/` | `cloudbuild.yaml` and the deploy scripts it calls |
| `environments/templates/` | Each deployable's configuration surface, placeholders only |

## Deployables

| Name | Runtime | Scaling | Notes |
|---|---|---|---|
| `sentinel-core` | Cloud Run service | min 1, max 10 | Decision API, Pub/Sub push consumer, REST, Vertex AI |
| `sentinel-stream` | Cloud Run service | min 1, max 3 | WebSocket gateway, session affinity, 60-minute timeout |
| `sentinel-ui` | Cloud Run service | min 1 | Static Angular SPA behind nginx |
| `sentinel-simulator` | Cloud Run Job | on demand | No minimum instances |

All at 1 vCPU / 512 MiB. `min-instances=1` is set on day one and never lowered: cold starts are how demos die.

## Service accounts (least privilege)

| Account | Roles |
|---|---|
| `sentinel-core` | `roles/aiplatform.user`; `secretAccessor` on `mongodb-uri` |
| `sentinel-stream` | `secretAccessor` on `mongodb-uri` |
| `sentinel-ui` | none |
| `sentinel-simulator` | `roles/pubsub.publisher` on `sentinel-transaction-events` |
| `sentinel-pubsub-push` | `roles/run.invoker` on `sentinel-core` |
| Cloud Build | `roles/run.admin`, `roles/iam.serviceAccountUser`, `roles/artifactregistry.writer` |

C§8 lists `Pub/Sub Subscriber` for `sentinel-core`; with a push subscription the service needs no Pub/Sub
role, and it does need `secretAccessor` for the Atlas URI. See `docs/deployment/cloud-run-deployment.md`.

## One-time setup order

1. Claim competition credits, set a billing budget alert, request Vertex AI quota.
2. Enable APIs: Cloud Run, Pub/Sub, Vertex AI, Artifact Registry, Cloud Build, Secret Manager.
3. Create the Artifact Registry repository `sentinel` in `asia-southeast1`.
4. Provision Atlas (`mongodb/`), then the secret (`secret-manager/`).
5. Create the service accounts above.
6. Create the topic, deploy once, then create the push subscription (`pubsub/`).
7. Connect the Cloud Build trigger to `main` with `infra/cloud-build/cloudbuild.yaml`.
