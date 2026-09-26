# Deployment

**Nothing is deployed and no cloud resource exists yet.** Manifests and runbooks are in `infra/`.

## Pipeline (Cloud Build, push to `main`)

`npm ci` → `npm run typecheck` → `npm run lint` → `npm test` → `npm run test:scenario` (DEMO_TAKEOVER_01) →
four Docker images → Artifact Registry → `gcloud run services replace` ×3 and `gcloud run jobs replace` ×1.
All steps run on `node:22.23.3-slim`. No manual deploys after 12 October; tag the submitted commit
`submission-v1` and record its digest in the README.

## Images

Each Dockerfile builds from the repository root in two stages (install and compile on `node:22.23.3-slim`, then
a slim runtime). `sentinel-ui` is served by `nginxinc/nginx-unprivileged:stable-alpine` with SPA fallback and
`/healthz`. The Dockerfiles have not been built locally (Docker is not installed on the authoring machine); the
first Cloud Build run is their validation.

## Open items for build steps 3–5

| Item | Why |
|---|---|
| UI runtime configuration | `sentinel-ui` currently uses `LOCAL_RUNTIME_CONFIG`; the deployed URLs of core and stream must reach the browser (for example a served `runtime-config.json`) |
| Push authentication | `sentinel-core` is publicly reachable for the browser, so the Pub/Sub push endpoint must verify the OIDC token itself |
| Atlas network access | "Cloud Run egress range" needs Direct VPC egress + Cloud NAT with a static IP, or an interim IP allow-list decision |
| Demo login | The single labelled demo login is not built; analyst identity on audit records depends on it |
| Model IDs | `GEMINI_FAST_MODEL` / `GEMINI_DEEP_MODEL` are empty until verified on Vertex AI (5 Oct) |

## IAM deviation from C§8

C§8 grants `sentinel-core` "Vertex AI User and Pub/Sub Subscriber, nothing more". With a push subscription,
`sentinel-core` needs no Pub/Sub role; it does need `secretAccessor` on `mongodb-uri`. The publisher role belongs
to `sentinel-simulator`. See `infra/README.md`.
