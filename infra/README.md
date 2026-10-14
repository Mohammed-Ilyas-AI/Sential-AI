# Infrastructure

One GCP project in `asia-southeast1` (Singapore); the project ID is never hard-coded (Cloud Build passes
`$PROJECT_ID` and `$PROJECT_NUMBER`). No Terraform and no GKE: four containers do not need an orchestrator.

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
| `sentinel-core` | Cloud Run service | min `_MIN_INSTANCES`, max 10 | Decision API, Pub/Sub push consumer, REST, Vertex AI; Direct VPC egress |
| `sentinel-stream` | Cloud Run service | min `_MIN_INSTANCES`, max 3 | WebSocket gateway, session affinity, 60-minute timeout; Direct VPC egress |
| `sentinel-ui` | Cloud Run service | min `_MIN_INSTANCES` | Static Angular SPA behind nginx; `/runtime-config.json` rendered from env at start |
| `sentinel-simulator` | Cloud Run Job | on demand | No minimum instances |

All at 1 vCPU / 512 MiB. `_MIN_INSTANCES` defaults to `0` so an idle project costs nothing for compute; set
it to `1` in the trigger's substitutions for rehearsals and the judged demo (cold starts are how demos die).

Service URLs are derived, never configured: `https://<service>-<project-number>.<region>.run.app`
(`cloud-build/scripts/service-urls.sh`). Core and stream reach Atlas through Cloud NAT's one reserved IP, which
is the only address on the Atlas access list; `0.0.0.0/0` is never used.

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

## One-time setup

1. Link billing and set a budget with alerts (alerts notify; they do not stop spend).
2. In Cloud Shell, from the repository root: `bash infra/cloud-build/scripts/bootstrap-project.sh <project-id>`.
   It enables the APIs and creates the Artifact Registry repository, service accounts, the `mongodb-uri`
   secret (you paste the URI; it is never echoed), the VPC with Cloud NAT and a reserved IP, and the Pub/Sub
   topic with its OIDC push subscription. It is idempotent.
3. Add the printed NAT IP to MongoDB Atlas > Network Access as a single `/32`.
4. Point the Cloud Build trigger at `infra/cloud-build/cloudbuild.yaml` on `^main$`, running as the service
   account the script printed. Every push to `main` then tests, builds and deploys all four deployables.
