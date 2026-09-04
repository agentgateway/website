#!/usr/bin/env bash
# Stand up a UI backed by PostgreSQL for the database-storage capture (storage.spec.ts):
#   1. PostgreSQL (docker, on a private network as `postgres`)
#   2. the agentgateway image with fixtures/storage-config.yaml (storage.mode: hybrid)
#
#   one command:  CAPTURE_MODE=storage npm run test:storage   (Playwright's webServer runs this)
#   manual:       ./scripts/serve-storage-ui.sh               then capture in another shell
#
# Unlike the file-backed modes, the UI here can SAVE. Agentgateway keeps UI-managed
# resources (MCP targets, LLM providers, models, routes) in the database and merges them
# over the config file at read time, so the captures show the writable UI that the Helm
# "Store config in a database" guide produces. Agentgateway creates its own schema on first
# start, so there is no migration step. Ctrl-C tears everything down.
set -euo pipefail

IMAGE="${AGW_IMAGE:-cr.agentgateway.dev/agentgateway:latest-dev}"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:16-alpine}"
UI_PORT="${UI_HOST_PORT:-15100}"
NET=agw-storage-net
HERE="$(cd "$(dirname "$0")/.." && pwd)"
CFG_DIR="$HERE/.agw-runtime"

mkdir -p "$CFG_DIR"
cp "$HERE/fixtures/storage-config.yaml" "$CFG_DIR/config.yaml"

cleanup() {
  echo "→ stopping…"
  docker rm -f agw-ui-storage agw-postgres >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM
cleanup

docker network create "$NET" >/dev/null

echo "→ starting PostgreSQL ($POSTGRES_IMAGE)"
docker run -d --rm --name agw-postgres --network "$NET" --network-alias postgres \
  -e POSTGRES_USER=agw -e POSTGRES_PASSWORD=agwpass -e POSTGRES_DB=agw \
  "$POSTGRES_IMAGE" >/dev/null

echo "→ waiting for PostgreSQL…"
until docker exec agw-postgres pg_isready -U agw -d agw >/dev/null 2>&1; do sleep 1; done

echo "→ starting agentgateway UI ($IMAGE) on :$UI_PORT"
docker run -d --rm --name agw-ui-storage --network "$NET" --user "$(id -u):$(id -g)" \
  -e ADMIN_ADDR=0.0.0.0:15000 \
  -v "$CFG_DIR:/config" \
  -p "$UI_PORT:15000" -p 4100:4000 \
  "$IMAGE" -f /config/config.yaml >/dev/null

echo "→ waiting for UI…"
until curl -sf -o /dev/null "http://localhost:$UI_PORT/ui/"; do sleep 1; done
echo "✓ UI ready at http://localhost:$UI_PORT/ui/ (storage.mode: hybrid)"
docker logs -f agw-ui-storage
