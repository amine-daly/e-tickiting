#!/usr/bin/env bash

set -euo pipefail

compose_file="${COMPOSE_FILE:-infra/docker-compose.prod.yml}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed on this server." >&2
  exit 1
fi

# Ensure .env exists
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo ".env not found — copying .env.example to .env and aborting so you can edit secrets." >&2
    cp .env.example .env
    echo "Edit .env on the server and set secure values (MONGO_INITDB_ROOT_PASSWORD, JWT_SECRET, etc.), then re-run the deploy." >&2
    exit 1
  else
    echo ".env not found and no .env.example available. Please create a .env in the app directory before deploying." >&2
    exit 1
  fi
fi

# Load .env into environment for checks
set -a
. ./.env
set +a

# Validate required secrets are set (non-empty)
missing=()
for v in MONGO_INITDB_ROOT_USERNAME MONGO_INITDB_ROOT_PASSWORD JWT_SECRET; do
  if [ -z "${!v:-}" ]; then
    missing+=("$v")
  fi
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "Missing required variables in .env: ${missing[*]}" >&2
  echo "Edit .env and set those values before deploying. Aborting." >&2
  exit 1
fi

# Determine host port for frontend from environment (defaults to 80)
FRONTEND_HOST_PORT="${FRONTEND_HOST_PORT:-${FRONTEND_HOST_PORT:-80}}"
if grep -q '^FRONTEND_HOST_PORT=' .env 2>/dev/null; then
  FRONTEND_HOST_PORT=$(grep '^FRONTEND_HOST_PORT=' .env | cut -d'=' -f2-)
fi

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

if check_port_in_use "$FRONTEND_HOST_PORT"; then
  echo "Port $FRONTEND_HOST_PORT is already in use on this host." >&2
  echo "Run one of the following on the server to diagnose and free the port:" >&2
  echo "  sudo ss -ltnp | grep :$FRONTEND_HOST_PORT" >&2
  echo "  sudo lsof -iTCP:$FRONTEND_HOST_PORT -sTCP:LISTEN -P -n" >&2
  echo "Common fixes: stop system web server (e.g. 'sudo systemctl stop nginx' or 'sudo systemctl stop apache2'), or change FRONTEND_HOST_PORT in .env to an unused port." >&2
  exit 1
fi

echo "All checks passed — starting Docker Compose (file: $compose_file)" >&2
docker compose -f "$compose_file" up -d --build --remove-orphans
