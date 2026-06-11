#!/usr/bin/env bash

set -euo pipefail

compose_file="${COMPOSE_FILE:-infra/docker-compose.prod.yml}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed on this server." >&2
  exit 1
fi

# Ensure .env exists. The GitHub Actions workflow uploads it from repository secrets.
if [ ! -f .env ]; then
  echo ".env not found. The deploy workflow should upload it from GitHub Secrets before this script runs." >&2
  echo "Required secrets: MONGO_INITDB_ROOT_USERNAME, MONGO_INITDB_ROOT_PASSWORD, JWT_SECRET." >&2
  echo "Optional secrets: MONGO_DB_NAME, SPRING_PROFILES_ACTIVE." >&2
  exit 1
fi

# Parse .env without sourcing to avoid shell expansion of special characters
env_file=".env"

get_env_value() {
  local key="$1"
  local line
  line="$(grep -m1 -E "^${key}=" "$env_file" || true)"
  if [ -z "$line" ]; then
    return 1
  fi
  printf '%s' "${line#*=}"
}

strip_quotes() {
  local value="$1"
  value="$(printf '%s' "$value" | sed -e "s/^'//" -e "s/'$//" -e 's/^"//' -e 's/"$//')"
  printf '%s' "$value"
}

# Validate required secrets are set (non-empty)
missing=()
for v in MONGO_INITDB_ROOT_USERNAME MONGO_INITDB_ROOT_PASSWORD JWT_SECRET MONGODB_URI; do
  value="$(get_env_value "$v" || true)"
  value="$(strip_quotes "$value")"
  if [ -z "$value" ]; then
    missing+=("$v")
  fi
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "Missing required variables in .env: ${missing[*]}" >&2
  echo "Edit .env and set those values before deploying. Aborting." >&2
  exit 1
fi

if [ -z "$(get_env_value AWS_ACCESS_KEY_ID || true)" ] || [ -z "$(get_env_value AWS_SECRET_ACCESS_KEY || true)" ] || [ -z "$(get_env_value AWS_REGION || true)" ] || [ -z "$(get_env_value AWS_S3_BUCKET || true)" ]; then
  echo "AWS S3 env vars are optional. Uploads will require an EC2 IAM role or these credentials in .env." >&2
fi

# Static frontends are served by host Nginx; only backend + mongo run in Docker.
docker compose --env-file "$env_file" -f "$compose_file" down --remove-orphans --volumes=false >/dev/null 2>&1 || true

echo "All checks passed — starting Docker Compose (file: $compose_file)" >&2
docker buildx prune --force 2>/dev/null || true
docker compose --env-file "$env_file" -f "$compose_file" up -d --build --remove-orphans
