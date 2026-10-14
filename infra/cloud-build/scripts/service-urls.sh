#!/usr/bin/env bash
# Sourced, not executed. Requires PROJECT_ID, PROJECT_NUMBER and REGION.
# Cloud Run's deterministic URL is https://<service>-<project-number>.<region>.run.app, so every URL is known before
# the first deploy and nothing has to be copied between steps by hand.
: "${PROJECT_ID:?PROJECT_ID is required}"
: "${PROJECT_NUMBER:?PROJECT_NUMBER is required}"
: "${REGION:?REGION is required}"

export CORE_URL="https://sentinel-core-${PROJECT_NUMBER}.${REGION}.run.app"
export UI_ORIGIN="https://sentinel-ui-${PROJECT_NUMBER}.${REGION}.run.app"
export STREAM_URL="wss://sentinel-stream-${PROJECT_NUMBER}.${REGION}.run.app/stream"
export PUSH_ENDPOINT="${CORE_URL}/internal/pubsub/transaction-events"
# The push subscription signs its OIDC token for this audience, and sentinel-core accepts no other.
export CORE_PUSH_AUDIENCE="${PUSH_ENDPOINT}"
export PUSH_SERVICE_ACCOUNT="sentinel-pubsub-push@${PROJECT_ID}.iam.gserviceaccount.com"
export VPC_NETWORK="sentinel-vpc"
export VPC_SUBNET="sentinel-run-${REGION}"
