#!/usr/bin/env bash
# Builds the image and starts the stack (app + Postgres) via docker compose.
# Usage: ./build.sh [docker compose up args...]
#
# The app reads all data from Postgres at runtime — nothing is prerendered
# against the database — so the build needs no secrets. Runtime config comes
# from .env.prod (see .env.prod.example).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

ENV_FILE=.env.prod
if [ ! -f "$ENV_FILE" ]; then
  echo "error: $ENV_FILE not found (copy .env.prod.example)" >&2
  exit 1
fi

docker compose build
docker compose up -d "$@"
