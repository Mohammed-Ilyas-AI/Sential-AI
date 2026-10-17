#!/usr/bin/env bash
# Usage: render-manifest.sh <template.yaml> <image>
# Substitutes the __TOKENS__ in a Cloud Run manifest and prints the result. Never contains a secret value.
# Fails if any token is left unsubstituted, so a half-configured manifest can never be deployed.
set -euo pipefail

template="$1"
image="$2"

rendered="$(sed \
  -e "s|__IMAGE__|${image}|g" \
  -e "s|__PROJECT_ID__|${PROJECT_ID}|g" \
  -e "s|__REGION__|${REGION}|g" \
  -e "s|__MIN_INSTANCES__|${MIN_INSTANCES:-0}|g" \
  -e "s|__UI_ORIGINS__|${UI_ORIGINS}|g" \
  -e "s|__UI_ORIGIN__|${UI_ORIGIN}|g" \
  -e "s|__CORE_URL__|${CORE_URL}|g" \
  -e "s|__STREAM_URL__|${STREAM_URL}|g" \
  -e "s|__CORE_PUSH_AUDIENCE__|${CORE_PUSH_AUDIENCE}|g" \
  -e "s|__PUSH_SERVICE_ACCOUNT__|${PUSH_SERVICE_ACCOUNT}|g" \
  -e "s|__VPC_NETWORK__|${VPC_NETWORK}|g" \
  -e "s|__VPC_SUBNET__|${VPC_SUBNET}|g" \
  -e "s|__DEMO_TIME_COMPRESSION__|${DEMO_TIME_COMPRESSION:-true}|g" \
  -e "s|__GEMINI_FAST_MODEL__|${GEMINI_FAST_MODEL:-}|g" \
  -e "s|__GEMINI_DEEP_MODEL__|${GEMINI_DEEP_MODEL:-}|g" \
  -e "s|__VERTEX_LOCATION__|${VERTEX_LOCATION:-${REGION}}|g" \
  -e "s|__GEMINI_FAST_THINKING_LEVEL__|${GEMINI_FAST_THINKING_LEVEL:-}|g" \
  -e "s|__GEMINI_DEEP_THINKING_LEVEL__|${GEMINI_DEEP_THINKING_LEVEL:-}|g" \
  "${template}")"

# Comment lines may mention tokens; only configuration lines must be fully rendered.
if grep -v '^[[:space:]]*#' <<< "${rendered}" | grep -q '__[A-Z_]*__'; then
  echo "render-manifest: unsubstituted tokens in ${template}:" >&2
  grep -v '^[[:space:]]*#' <<< "${rendered}" | grep -o '__[A-Z_]*__' | sort -u >&2
  exit 1
fi
printf '%s\n' "${rendered}"
