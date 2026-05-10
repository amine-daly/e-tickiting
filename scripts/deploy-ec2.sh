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
  echo "Optional secrets: MONGO_DB_NAME, SPRING_PROFILES_ACTIVE, FRONTEND_HOST_PORT." >&2
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

# Determine host port for frontend from .env (defaults to 80)
FRONTEND_HOST_PORT="$(strip_quotes "$(get_env_value FRONTEND_HOST_PORT || true)")"
FRONTEND_HOST_PORT="${FRONTEND_HOST_PORT:-80}"

# Stop the existing stack first so redeploys do not fail on their own published port.
docker compose --env-file "$env_file" -f "$compose_file" down --remove-orphans >/dev/null 2>&1 || true

# Check if port is already in use on the host
check_port_in_use() {
  port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltnp 2>/dev/null | grep -q ":${port} " && return 0 || return 1
  elif command -v netstat >/dev/null 2>&1; then
    netstat -tlnp 2>/dev/null | grep -q ":${port} " && return 0 || return 1
  else
    # If neither tool available, skip check
    return 2
  fi
}

stop_docker_containers_using_port() {
  port="$1"
  container_ids="$(docker ps --filter "publish=${port}" -q)"
  if [ -n "$container_ids" ]; then
    echo "Stopping Docker containers using port $port: $container_ids" >&2
    docker rm -f $container_ids >/dev/null 2>&1 || true
  fi
}

stop_service_if_possible() {
  service="$1"
  if ! command -v systemctl >/dev/null 2>&1; then
    return 1
  fi

  if ! systemctl list-unit-files "$service.service" >/dev/null 2>&1; then
    return 1
  fi

  if ! systemctl is-active --quiet "$service"; then
    return 1
  fi

  echo "Stopping conflicting service: $service" >&2
  if command -v sudo >/dev/null 2>&1; then
    sudo -n systemctl stop "$service" >/dev/null 2>&1 || return 1
    sudo -n systemctl disable "$service" >/dev/null 2>&1 || true
  else
    systemctl stop "$service" >/dev/null 2>&1 || return 1
    systemctl disable "$service" >/dev/null 2>&1 || true
  fi
}

if check_port_in_use "$FRONTEND_HOST_PORT"; then
  echo "Port $FRONTEND_HOST_PORT is already in use on this host. Attempting automatic recovery." >&2
  stop_docker_containers_using_port "$FRONTEND_HOST_PORT"
  stop_service_if_possible nginx || true
  stop_service_if_possible apache2 || true
  stop_service_if_possible httpd || true

  if check_port_in_use "$FRONTEND_HOST_PORT"; then
    echo "Port $FRONTEND_HOST_PORT is still in use after automatic recovery attempts." >&2
    echo "Run one of the following on the server to diagnose the remaining conflict:" >&2
    echo "  sudo ss -ltnp | grep :$FRONTEND_HOST_PORT" >&2
    echo "  sudo lsof -iTCP:$FRONTEND_HOST_PORT -sTCP:LISTEN -P -n" >&2
    echo "If the port must stay occupied, set FRONTEND_HOST_PORT in the deployment secrets to an unused port." >&2
    exit 1
  fi
fi

echo "All checks passed — starting Docker Compose (file: $compose_file)" >&2
docker compose --env-file "$env_file" -f "$compose_file" up -d --build --remove-orphans
