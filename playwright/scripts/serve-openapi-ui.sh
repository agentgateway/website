#!/usr/bin/env bash
# Stand up an OPENAPI -> MCP UI for the openapi.spec.ts capture:
#   1. the Swagger Petstore server (host :8080, via the swaggerapi/petstore3 image)
#   2. its OpenAPI schema curled into .agw-runtime/openapi.json (mounted at /config)
#   3. the new-UI image (sl8) wired to it via fixtures/openapi-config.yaml
#
#   one command:  CAPTURE_MODE=openapi npm run test:openapi   (Playwright's webServer runs this)
#   manual:       ./scripts/serve-openapi-ui.sh               then capture in another shell
#
# Ctrl-C (or Playwright's webServer teardown) tears everything down. Requires Docker.
set -euo pipefail

IMAGE="${AGW_IMAGE:-howardjohn/agentgateway:sl8}"
PETSTORE_IMAGE="${PETSTORE_IMAGE:-swaggerapi/petstore3:latest}"
UI_PORT="${UI_HOST_PORT:-15100}"
MCP_PORT=3030          # must match mcp.port in fixtures/openapi-config.yaml
PETSTORE_PORT=8080
HERE="$(cd "$(dirname "$0")/.." && pwd)"
CFG_DIR="$HERE/.agw-runtime"
SRC_CFG="$HERE/fixtures/openapi-config.yaml"

mkdir -p "$CFG_DIR"
cp "$SRC_CFG" "$CFG_DIR/config.yaml"

cleanup() {
  echo "→ stopping…"
  docker rm -f agw-ui-openapi agw-petstore >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "→ starting Petstore on :$PETSTORE_PORT ($PETSTORE_IMAGE)"
docker rm -f agw-petstore >/dev/null 2>&1 || true
docker run -d --rm --name agw-petstore -p "$PETSTORE_PORT:8080" "$PETSTORE_IMAGE" >/dev/null

echo "→ waiting for Petstore OpenAPI schema…"
until curl -sf "http://localhost:$PETSTORE_PORT/api/v3/openapi.json" -o "$CFG_DIR/openapi.json"; do sleep 1; done
echo "✓ schema saved to .agw-runtime/openapi.json"

echo "→ starting agentgateway UI ($IMAGE) on :$UI_PORT (UI) / :$MCP_PORT (MCP)"
docker rm -f agw-ui-openapi >/dev/null 2>&1 || true
docker run --rm --name agw-ui-openapi --user "$(id -u):$(id -g)" \
  -e ADMIN_ADDR=0.0.0.0:15000 \
  -v "$CFG_DIR:/config" \
  -p "$UI_PORT:15000" -p "$MCP_PORT:$MCP_PORT" -p 4100:4000 \
  "$IMAGE" -f /config/config.yaml &

echo "→ waiting for UI…"
until curl -sf -o /dev/null "http://localhost:$UI_PORT/ui/"; do sleep 1; done
echo "✓ UI ready at http://localhost:$UI_PORT/ui/"
wait
