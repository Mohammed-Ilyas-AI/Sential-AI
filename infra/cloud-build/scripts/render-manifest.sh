#!/usr/bin/env bash
# Usage: render-manifest.sh <template.yaml> <image>
# Substitutes the __TOKENS__ in a Cloud Run manifest and prints the result. Never contains a secret value.
set -euo pipefail

template="$1"
image="$2"

sed \
  -e "s|__IMAGE__|${image}|g" \
  -e "s|__PROJECT_ID__|${PROJECT_ID}|g" \
  -e "s|__UI_ORIGIN__|${UI_ORIGIN:-}|g" \
  -e "s|__CORE_URL__|${CORE_URL:-}|g" \
  -e "s|__GEMINI_FAST_MODEL__|${GEMINI_FAST_MODEL:-}|g" \
  -e "s|__GEMINI_DEEP_MODEL__|${GEMINI_DEEP_MODEL:-}|g" \
  "${template}"
