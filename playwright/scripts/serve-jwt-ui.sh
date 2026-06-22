#!/usr/bin/env bash
# Stand up a UI for the JWT / observability capture (jwt.spec.ts):
#   1. server-everything (host :3005)  -> `everything` target
#   2. the new-UI image (sl8) wired to it via fixtures/jwt-config.yaml (adds metrics tags)
#
#   one command:  CAPTURE_MODE=jwt npm run test:jwt   (Playwright's webServer runs this)
#   manual:       ./scripts/serve-jwt-ui.sh           then capture in another shell
#
# Same backend as the MCP playground capture; the JWT angle is entirely a UI step (the spec
# fills the playground's "Authorization header" Bearer token). Ctrl-C tears everything down.
set -euo pipefail

IMAGE="${AGW_IMAGE:-howardjohn/agentgateway:sl8}"
UI_PORT="${UI_HOST_PORT:-15100}"
MCP_PORT=3030          # must match mcp.port in fixtures/jwt-config.yaml
EVERYTHING_PORT=3005
HERE="$(cd "$(dirname "$0")/.." && pwd)"
CFG_DIR="$HERE/.agw-runtime"
SRC_CFG="$HERE/fixtures/jwt-config.yaml"

mkdir -p "$CFG_DIR"
cp "$SRC_CFG" "$CFG_DIR/config.yaml"

cleanup() {
  echo "→ stopping…"
  docker rm -f agw-ui-jwt >/dev/null 2>&1 || true
  [[ -n "${EVERYTHING_PID:-}" ]] && kill "$EVERYTHING_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "→ starting server-everything on :$EVERYTHING_PORT"
PORT=$EVERYTHING_PORT npx -y @modelcontextprotocol/server-everything streamableHttp >/tmp/mcp-everything.log 2>&1 &
EVERYTHING_PID=$!

echo "→ starting agentgateway UI ($IMAGE) on :$UI_PORT (UI) / :$MCP_PORT (MCP)"
docker rm -f agw-ui-jwt >/dev/null 2>&1 || true
docker run --rm --name agw-ui-jwt --user "$(id -u):$(id -g)" \
  -e ADMIN_ADDR=0.0.0.0:15000 \
  -v "$CFG_DIR:/config" \
  -p "$UI_PORT:15000" -p "$MCP_PORT:$MCP_PORT" -p 4100:4000 \
  "$IMAGE" -f /config/config.yaml &

echo "→ waiting for UI…"
until curl -sf -o /dev/null "http://localhost:$UI_PORT/ui/"; do sleep 1; done
echo "✓ UI ready at http://localhost:$UI_PORT/ui/"
wait
