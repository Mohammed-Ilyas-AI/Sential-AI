#!/usr/bin/env bash
# Usage: deploy-service.sh <service-name>
# Requires PROJECT_ID, REGION, REGISTRY and TAG. Applies infra/cloud-run/<service-name>/service.yaml.
set -euo pipefail

service="$1"
scripts_dir="$(dirname "$0")"
manifest="$(mktemp)"

"${scripts_dir}/render-manifest.sh" "infra/cloud-run/${service}/service.yaml" "${REGISTRY}/${service}:${TAG}" > "${manifest}"
gcloud run services replace "${manifest}" --region "${REGION}"
