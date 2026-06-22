#!/usr/bin/env bash
# Stand up a MULTIPLEX (virtual MCP) UI for the virtual.spec.ts capture:
#   1. server-everything (host :3005)            -> `everything` target
#   2. mock-mcp-time (host :3006, fixed output)  -> `time` target
#   3. the new-UI image (sl8) wired to both via fixtures/virtual-config.yaml
#
#   one command:  CAPTURE_MODE=virtual npm run test:virtual   (Playwright's webServer runs this)
#   manual:       ./scripts/serve-virtual-ui.sh               then capture in another shell
#
# Ctrl-C (or Playwright's webServer teardown) tears everything down. Requires Docker + Node 18+.
#
# The `time` target uses scripts/mock-mcp-time.mjs (deterministic) rather than the guide's
# `uvx mcp-server-time` because the distroless sl8 image cannot exec stdio targets. To use
# the real server instead, bridge it to HTTP: `uvx mcp-proxy --port 3006 -- uvx mcp-server-time`.
set -euo pipefail

IMAGE="${AGW_IMAGE:-howardjohn/agentgateway:sl8}"
UI_PORT="${UI_HOST_PORT:-15100}"
MCP_PORT=3030          # must match mcp.port in fixtures/virtual-config.yaml
EVERYTHING_PORT=3005
TIME_PORT=3006
HERE="$(cd "$(dirname "$0")/.." && pwd)"
CFG_DIR="$HERE/.agw-runtime"
SRC_CFG="$HERE/fixtures/virtual-config.yaml"

mkdir -p "$CFG_DIR"
cp "$SRC_CFG" "$CFG_DIR/config.yaml"

cleanup() {
  echo "→ stopping…"
  docker rm -f agw-ui-virtual >/dev/null 2>&1 || true
  [[ -n "${EVERYTHING_PID:-}" ]] && kill "$EVERYTHING_PID" >/dev/null 2>&1 || true
  [[ -n "${TIME_PID:-}" ]] && kill "$TIME_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "→ starting server-everything on :$EVERYTHING_PORT"
PORT=$EVERYTHING_PORT npx -y @modelcontextprotocol/server-everything streamableHttp >/tmp/mcp-everything.log 2>&1 &
EVERYTHING_PID=$!

echo "→ starting mock-mcp-time on :$TIME_PORT"
PORT=$TIME_PORT node "$HERE/scripts/mock-mcp-time.mjs" >/tmp/mcp-time.log 2>&1 &
TIME_PID=$!

echo "→ starting agentgateway UI ($IMAGE) on :$UI_PORT (UI) / :$MCP_PORT (MCP)"
docker rm -f agw-ui-virtual >/dev/null 2>&1 || true
docker run --rm --name agw-ui-virtual --user "$(id -u):$(id -g)" \
  -e ADMIN_ADDR=0.0.0.0:15000 \
  -v "$CFG_DIR:/config" \
  -p "$UI_PORT:15000" -p "$MCP_PORT:$MCP_PORT" -p 4100:4000 \
  "$IMAGE" -f /config/config.yaml &

echo "→ waiting for UI…"
until curl -sf -o /dev/null "http://localhost:$UI_PORT/ui/"; do sleep 1; done
echo "✓ UI ready at http://localhost:$UI_PORT/ui/"
wait
