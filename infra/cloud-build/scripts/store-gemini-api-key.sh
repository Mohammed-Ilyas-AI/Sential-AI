#!/usr/bin/env bash
# Stores the Gemini API key in Secret Manager for sentinel-core. Run it yourself in Cloud Shell, from the repository
# root, before the first deploy with _GEMINI_PROVIDER=gemini-api (the default in cloudbuild.yaml):
#
#   bash infra/cloud-build/scripts/store-gemini-api-key.sh <project-id> [region]
#
# The key is read with hidden input: it never appears on screen, in shell history, in the repository or in a log.
# Run it again to rotate the key (a new version is added; sentinel-core reads "latest" on its next revision).
# Only the sentinel-core service account can read it. Create the key in Google AI Studio (aistudio.google.com),
# ideally restricted to the Generative Language API.
set -euo pipefail

PROJECT_ID="${1:?usage: store-gemini-api-key.sh <project-id> [region]}"
REGION="${2:-asia-southeast1}"
SECRET="gemini-api-key"
CORE_ACCOUNT="sentinel-core@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud config set project "${PROJECT_ID}" > /dev/null
gcloud services enable secretmanager.googleapis.com generativelanguage.googleapis.com > /dev/null

if ! gcloud secrets describe "${SECRET}" > /dev/null 2>&1; then
  gcloud secrets create "${SECRET}" --replication-policy=user-managed --locations="${REGION}" > /dev/null
  echo "Created secret ${SECRET}."
fi

printf 'Paste the Gemini API key (input hidden), then press Enter: '
read -rs GEMINI_API_KEY
printf '\n'
if [[ -z "${GEMINI_API_KEY}" ]]; then
  echo "No key entered; nothing stored." >&2
  exit 1
fi
printf '%s' "${GEMINI_API_KEY}" | gcloud secrets versions add "${SECRET}" --data-file=- > /dev/null
unset GEMINI_API_KEY
echo "Stored as a new version of ${SECRET}."

gcloud secrets add-iam-policy-binding "${SECRET}" --member="serviceAccount:${CORE_ACCOUNT}" \
  --role=roles/secretmanager.secretAccessor > /dev/null
echo "sentinel-core can read ${SECRET}; no other account can."
