#!/usr/bin/env bash

set -euo pipefail

compose_file="${COMPOSE_FILE:-infra/docker-compose.prod.yml}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed on this server." >&2
  exit 1
fi

docker compose -f "$compose_file" up -d --build --remove-orphans
