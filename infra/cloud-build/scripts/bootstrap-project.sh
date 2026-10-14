#!/usr/bin/env bash
# One-time setup of a Google Cloud project for SENTINEL AI. Run it yourself in Cloud Shell, from the repository root:
#
#   bash infra/cloud-build/scripts/bootstrap-project.sh <project-id> [region]
#
# Idempotent: anything that already exists is left as it is, so it is safe to run again.
#
# What it creates, and what costs money (check current pricing for your region):
#   - APIs: Cloud Run, Cloud Build, Artifact Registry, Secret Manager, Pub/Sub, Vertex AI, Compute, IAM  (no charge)
#   - Artifact Registry repository "sentinel"                                    (storage, cents per month)
#   - Service accounts for core, stream, ui, simulator and the Pub/Sub push      (no charge)
#   - Secret "mongodb-uri"; you paste the Atlas URI, it is never echoed or logged (cents per month)
#   - VPC "sentinel-vpc", a subnet, Cloud Router, Cloud NAT and one reserved static IP
#       -> the ongoing cost (roughly USD 35-40 per month). It gives core and stream one fixed outbound address,
#          so Atlas can allow exactly that /32 and never 0.0.0.0/0.
#   - Pub/Sub topic and an OIDC-authenticated push subscription to sentinel-core (pay per use)
# It does not deploy anything: Cloud Build does that from main.
set -euo pipefail

PROJECT_ID="${1:?usage: bootstrap-project.sh <project-id> [region]}"
REGION="${2:-asia-southeast1}"
REPOSITORY="sentinel"
TOPIC="sentinel-transaction-events"
SUBSCRIPTION="sentinel-core-transaction-events"
SUBNET_RANGE="10.20.0.0/24"

gcloud config set project "${PROJECT_ID}" > /dev/null
PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
export PROJECT_ID PROJECT_NUMBER REGION
# shellcheck source=service-urls.sh
source "$(dirname "$0")/service-urls.sh"

step() { printf '\n== %s\n' "$*"; }
exists() { "$@" > /dev/null 2>&1; }

step "Billing"
if [[ "$(gcloud billing projects describe "${PROJECT_ID}" --format='value(billingEnabled)')" != "True" ]]; then
  echo "Billing is not enabled on ${PROJECT_ID}. Link a billing account and set a budget first; nothing was created."
  exit 1
fi
echo "Billing is enabled. Set a budget with alerts in Billing > Budgets & alerts if you have not (alerts notify; they do not stop spend)."

step "APIs"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com pubsub.googleapis.com aiplatform.googleapis.com compute.googleapis.com \
  iam.googleapis.com

step "Artifact Registry repository ${REPOSITORY} (${REGION})"
exists gcloud artifacts repositories describe "${REPOSITORY}" --location "${REGION}" ||
  gcloud artifacts repositories create "${REPOSITORY}" --repository-format=docker --location "${REGION}" \
    --description="SENTINEL AI container images"

step "Service accounts"
for account in sentinel-core sentinel-stream sentinel-ui sentinel-simulator sentinel-pubsub-push; do
  exists gcloud iam service-accounts describe "${account}@${PROJECT_ID}.iam.gserviceaccount.com" ||
    gcloud iam service-accounts create "${account}" --display-name="${account}"
done
sa() { printf '%s@%s.iam.gserviceaccount.com' "$1" "${PROJECT_ID}"; }

# sentinel-core explains with Gemini; nothing else may call Vertex AI.
gcloud projects add-iam-policy-binding "${PROJECT_ID}" --member="serviceAccount:$(sa sentinel-core)" \
  --role=roles/aiplatform.user --condition=None > /dev/null

step "Secret mongodb-uri"
exists gcloud secrets describe mongodb-uri ||
  gcloud secrets create mongodb-uri --replication-policy=user-managed --locations="${REGION}"
if ! exists gcloud secrets versions describe latest --secret=mongodb-uri; then
  printf 'Paste the MongoDB Atlas connection string (input hidden), then press Enter: '
  read -rs MONGODB_URI
  printf '\n'
  printf '%s' "${MONGODB_URI}" | gcloud secrets versions add mongodb-uri --data-file=- > /dev/null
  unset MONGODB_URI
  echo "Stored as a new secret version."
else
  echo "A version already exists; left unchanged (add one with: gcloud secrets versions add mongodb-uri --data-file=-)."
fi
for account in sentinel-core sentinel-stream; do
  gcloud secrets add-iam-policy-binding mongodb-uri --member="serviceAccount:$(sa "${account}")" \
    --role=roles/secretmanager.secretAccessor > /dev/null
done

step "Network: ${VPC_NETWORK}, Cloud NAT and one reserved outbound IP"
exists gcloud compute networks describe "${VPC_NETWORK}" ||
  gcloud compute networks create "${VPC_NETWORK}" --subnet-mode=custom
exists gcloud compute networks subnets describe "${VPC_SUBNET}" --region "${REGION}" ||
  gcloud compute networks subnets create "${VPC_SUBNET}" --network "${VPC_NETWORK}" --region "${REGION}" \
    --range "${SUBNET_RANGE}" --enable-private-ip-google-access
exists gcloud compute addresses describe sentinel-nat-ip --region "${REGION}" ||
  gcloud compute addresses create sentinel-nat-ip --region "${REGION}"
exists gcloud compute routers describe sentinel-router --region "${REGION}" ||
  gcloud compute routers create sentinel-router --network "${VPC_NETWORK}" --region "${REGION}"
exists gcloud compute routers nats describe sentinel-nat --router sentinel-router --region "${REGION}" ||
  gcloud compute routers nats create sentinel-nat --router sentinel-router --region "${REGION}" \
    --nat-all-subnet-ip-ranges --nat-external-ip-pool=sentinel-nat-ip
NAT_IP="$(gcloud compute addresses describe sentinel-nat-ip --region "${REGION}" --format='value(address)')"

step "Pub/Sub topic and push subscription"
exists gcloud pubsub topics describe "${TOPIC}" ||
  gcloud pubsub topics create "${TOPIC}" --message-storage-policy-allowed-regions="${REGION}"
gcloud pubsub topics add-iam-policy-binding "${TOPIC}" --member="serviceAccount:$(sa sentinel-simulator)" \
  --role=roles/pubsub.publisher > /dev/null
# Pub/Sub signs push tokens as the push service account.
gcloud iam service-accounts add-iam-policy-binding "${PUSH_SERVICE_ACCOUNT}" \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com" \
  --role=roles/iam.serviceAccountTokenCreator > /dev/null ||
  echo "Pub/Sub service agent grant skipped (projects created after April 2021 do not need it)."
exists gcloud pubsub subscriptions describe "${SUBSCRIPTION}" ||
  gcloud pubsub subscriptions create "${SUBSCRIPTION}" --topic "${TOPIC}" \
    --push-endpoint="${PUSH_ENDPOINT}" --push-auth-service-account="${PUSH_SERVICE_ACCOUNT}" \
    --push-auth-token-audience="${CORE_PUSH_AUDIENCE}" --enable-message-ordering --ack-deadline=30

step "Cloud Build service account"
BUILD_SA="${BUILD_SA:-${PROJECT_NUMBER}-compute@developer.gserviceaccount.com}"
for role in roles/run.admin roles/iam.serviceAccountUser roles/artifactregistry.writer roles/logging.logWriter; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" --member="serviceAccount:${BUILD_SA}" --role="${role}" \
    --condition=None > /dev/null
done
echo "Granted to ${BUILD_SA}. If your trigger runs as a different account, rerun with BUILD_SA=<that account>."

cat <<EOF

Done. Two things only you can do:

  1. MongoDB Atlas > Network Access > Add IP Address:  ${NAT_IP}/32   (comment: SENTINEL AI Cloud Run)
     Wait until it shows Active. Do not add 0.0.0.0/0.

  2. Cloud Build > Triggers > your trigger > Edit:
       Configuration: Cloud Build configuration file (yaml or json)
       Location:      Repository  ->  infra/cloud-build/cloudbuild.yaml
       Branch:        ^main\$
       Service account: ${BUILD_SA}
     Then Run. The deployed URLs will be:
       UI      ${UI_ORIGIN}
       Core    ${CORE_URL}
       Stream  ${STREAM_URL}
EOF
