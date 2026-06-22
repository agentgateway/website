#!/usr/bin/env bash
# Stand up an OPENAPI -> MCP UI for the openapi.spec.ts capture:
#   1. the Petstore OpenAPI schema (fixtures/petstore-openapi.json — the real spec) copied
#      into .agw-runtime/openapi.json and read by the gateway via schema.file
#   2. a fast, native mock of the Petstore data API on host :8080 (scripts/mock-petstore.mjs)
#   3. the new-UI image (sl8) wired to it via fixtures/openapi-config.yaml
#
#   one command:  CAPTURE_MODE=openapi npm run test:openapi   (Playwright's webServer runs this)
#   manual:       ./scripts/serve-openapi-ui.sh               then capture in another shell
#
# Why the mock instead of the guide's swaggerapi/petstore3 container: that image is amd64
# (Java/Jetty) and unusably slow under qemu on arm64. The mock is deterministic and arch-
# neutral; the tool LIST still comes from the real spec, so it matches the guide. To use the
# real server instead, set PETSTORE_REAL=1 (runs swaggerapi/petstore3:unstable on :8080 and
# curls its schema) — works on native amd64 (e.g. CI), slow under emulation.
set -euo pipefail

IMAGE="${AGW_IMAGE:-cr.agentgateway.dev/agentgateway:v1.3.0}"
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
  [[ -n "${PETSTORE_PID:-}" ]] && kill "$PETSTORE_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

if [[ "${PETSTORE_REAL:-}" == "1" ]]; then
  echo "→ starting real Petstore (swaggerapi/petstore3:unstable) on :$PETSTORE_PORT"
  docker rm -f agw-petstore >/dev/null 2>&1 || true
  docker run -d --rm --name agw-petstore -p "$PETSTORE_PORT:8080" swaggerapi/petstore3:unstable >/dev/null
  echo "→ waiting for Petstore schema…"
  until curl -sf "http://localhost:$PETSTORE_PORT/api/v3/openapi.json" -o "$CFG_DIR/openapi.json"; do sleep 2; done
else
  echo "→ starting mock Petstore on :$PETSTORE_PORT (schema from fixtures/petstore-openapi.json)"
  cp "$HERE/fixtures/petstore-openapi.json" "$CFG_DIR/openapi.json"
  PORT=$PETSTORE_PORT node "$HERE/scripts/mock-petstore.mjs" >/tmp/petstore.log 2>&1 &
  PETSTORE_PID=$!
fi

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
