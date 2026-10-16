#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID to your Google Cloud project id.}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-contextos-backend}"
GEMINI_SECRET_NAME="${GEMINI_SECRET_NAME:-contextos-gemini-api-key}"
GEMINI_MODEL="${CONTEXTOS_GEMINI_MODEL:-gemini-3.5-flash-lite}"
ALLOWED_ORIGINS="${CONTEXTOS_ALLOWED_ORIGINS:-chrome-extension://*}"

gcloud config set project "${PROJECT_ID}"

gcloud run deploy "${SERVICE_NAME}" \
  --source backend \
  --region "${REGION}" \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 2 \
  --set-env-vars "SPRING_PROFILES_ACTIVE=gcp,CONTEXTOS_PERSISTENCE=firestore,CONTEXTOS_GEMINI_ENABLED=true,CONTEXTOS_GEMINI_MODEL=${GEMINI_MODEL},CONTEXTOS_ALLOWED_ORIGINS=${ALLOWED_ORIGINS},GOOGLE_CLOUD_PROJECT=${PROJECT_ID}" \
  --set-secrets "GOOGLE_API_KEY=${GEMINI_SECRET_NAME}:latest"
