#!/usr/bin/env bash
# Sourced, not executed. Requires PROJECT_ID, PROJECT_NUMBER and REGION.
# Cloud Run's deterministic URL is https://<service>-<project-number>.<region>.run.app, so every URL is known before
# the first deploy and nothing has to be copied between steps by hand.
: "${PROJECT_ID:?PROJECT_ID is required}"
: "${PROJECT_NUMBER:?PROJECT_NUMBER is required}"
: "${REGION:?REGION is required}"

export CORE_URL="https://sentinel-core-${PROJECT_NUMBER}.${REGION}.run.app"
export UI_ORIGIN="https://sentinel-ui-${PROJECT_NUMBER}.${REGION}.run.app"
# The public address users and judges open. Defaults to the derived URL so a fresh project still works.
export PUBLIC_UI_ORIGIN="${PUBLIC_UI_ORIGIN:-${UI_ORIGIN}}"
if [[ ! "${PUBLIC_UI_ORIGIN}" =~ ^https://[a-z0-9.-]+$ ]]; then
  echo "service-urls: PUBLIC_UI_ORIGIN must be an exact https origin with no path, got '${PUBLIC_UI_ORIGIN}'" >&2
  return 1
fi
export PUBLIC_UI_HOST="${PUBLIC_UI_ORIGIN#https://}"
# The only browser origin core and stream accept: the run.app UI addresses redirect to the public one.
export UI_ORIGINS="${PUBLIC_UI_ORIGIN}"
export STREAM_URL="wss://sentinel-stream-${PROJECT_NUMBER}.${REGION}.run.app/stream"
export PUSH_ENDPOINT="${CORE_URL}/internal/pubsub/transaction-events"
# The push subscription signs its OIDC token for this audience, and sentinel-core accepts no other.
export CORE_PUSH_AUDIENCE="${PUSH_ENDPOINT}"
export PUSH_SERVICE_ACCOUNT="sentinel-pubsub-push@${PROJECT_ID}.iam.gserviceaccount.com"
export VPC_NETWORK="sentinel-vpc"
export VPC_SUBNET="sentinel-run-${REGION}"
