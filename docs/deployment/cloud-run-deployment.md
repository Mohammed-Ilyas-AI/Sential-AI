# Deployment

Manifests, scripts and the one-time setup are in `infra/` (see `infra/README.md`). Deployment target:
the competition project in `asia-southeast1`, built and deployed by Cloud Build from `main`.

## Pipeline (Cloud Build, push to `main`)

`npm ci` → `npm run typecheck` → `npm run lint` → `npm test` → `npm run test:scenario` (DEMO_TAKEOVER_01) →
four Docker images → Artifact Registry → `gcloud run services replace` ×3 and `gcloud run jobs replace` ×1.
All steps run on `node:24.18.0-slim`. No manual deploys after 12 October; tag the submitted commit
`submission-v1` and record its digest in the README.

## Images

Each Dockerfile builds from the repository root in two stages (install and compile on `node:24.18.0-slim`, then
a slim runtime). `sentinel-ui` is served by `nginxinc/nginx-unprivileged:stable-alpine` with SPA fallback and
`/healthz`. The Dockerfiles have not been built locally (Docker is not installed on the authoring machine); the
first Cloud Build run is their validation.

## Resolved deployment items

| Item | Resolution |
|---|---|
| UI runtime configuration | `sentinel-ui` renders `/runtime-config.json` from `CORE_API_BASE_URL`, `STREAM_URL` and `DEMO_TIME_COMPRESSION` at container start (nginx template); the browser never falls back to localhost |
| Service URLs | Derived from `$PROJECT_NUMBER` and the region (`service-urls.sh`), so the first deploy knows every URL |
| Push authentication | The subscription signs its OIDC token for the push endpoint URL as `sentinel-pubsub-push`; `sentinel-core` verifies exactly that audience and account |
| Atlas network access | Direct VPC egress from core and stream through Cloud NAT with one reserved IP, allowed in Atlas as a `/32` |
| Idle cost | `_MIN_INSTANCES=0` by default; raise to `1` for demo windows |
| Manifest safety | `render-manifest.sh` fails the deploy if any `__TOKEN__` is left unsubstituted |
| Gemini | `_GEMINI_PROVIDER=gemini-api` with the key in Secret Manager (`store-gemini-api-key.sh`, run once before the deploy); `_GEMINI_FAST_MODEL=gemini-3.5-flash`, `_GEMINI_DEEP_MODEL=gemini-3.1-pro-preview`, verified 14 Oct. Re-check the IDs before the finale. ADR-010 |

## Still open

| Item | Why |
|---|---|
| Demo login | The single labelled demo login is not built; the core REST API has no authentication |

## IAM deviation from C§8

C§8 grants `sentinel-core` "Vertex AI User and Pub/Sub Subscriber, nothing more". With a push subscription,
`sentinel-core` needs no Pub/Sub role; it does need `secretAccessor` on `mongodb-uri`. The publisher role belongs
to `sentinel-simulator`. See `infra/README.md`.
