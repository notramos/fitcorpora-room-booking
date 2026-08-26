#!/usr/bin/env bash
# Extracts GOOGLE_* values from .env.prod into ./.secrets/* files (used by
# docker-compose.yml's `secrets:` block — app/display prerenders at build
# time using live Google Sheets data, so the builder stage needs these)
# and runs the build. Usage: ./build.sh [docker compose args...]
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

ENV_FILE=.env.prod
if [ ! -f "$ENV_FILE" ]; then
  echo "error: $ENV_FILE not found" >&2
  exit 1
fi

get_value() {
  # Last matching key wins, strips one layer of surrounding quotes if present.
  local key="$1"
  local line
  line=$(grep -E "^${key}=" "$ENV_FILE" | tail -n1)
  local value="${line#*=}"
  value="${value%\"}"
  value="${value#\"}"
  printf '%s' "$value"
}

mkdir -p .secrets
chmod 700 .secrets

for key in GOOGLE_SERVICE_ACCOUNT_EMAIL GOOGLE_PRIVATE_KEY GOOGLE_SHEET_ID; do
  value=$(get_value "$key")
  if [ -z "$value" ]; then
    echo "error: $key is empty in $ENV_FILE" >&2
    exit 1
  fi
done

get_value GOOGLE_SERVICE_ACCOUNT_EMAIL > .secrets/google_sa_email
get_value GOOGLE_PRIVATE_KEY > .secrets/google_private_key
get_value GOOGLE_SHEET_ID > .secrets/google_sheet_id
chmod 600 .secrets/google_sa_email .secrets/google_private_key .secrets/google_sheet_id

docker compose build
docker compose up -d "$@"
