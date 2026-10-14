#!/usr/bin/env bash
# Usage: deploy-job.sh <job-name>
# Requires PROJECT_ID, REGION, REGISTRY and TAG. Applies infra/cloud-run/<job-name>/job.yaml; it does not execute the job.
set -euo pipefail

job="$1"
scripts_dir="$(dirname "$0")"
manifest="$(mktemp)"

bash "${scripts_dir}/render-manifest.sh" "infra/cloud-run/${job}/job.yaml" "${REGISTRY}/${job}:${TAG}" > "${manifest}"
gcloud run jobs replace "${manifest}" --region "${REGION}"
