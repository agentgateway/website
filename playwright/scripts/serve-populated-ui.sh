#!/usr/bin/env bash
# Stand up a POPULATED agentgateway UI for the MCP playground capture:
#   1. an MCP test server (server-everything) on the host at :3005
#   2. the new-UI image (sl8) wired to it, serving the UI at http://localhost:15100/ui/
#
# Then capture against it:
#   UI_BASE_URL=http://localhost:15100 npm run test:standalone
#
# Ctrl-C tears both down. Requires Docker and Node 18+ (npx).
set -euo pipefail

IMAGE="${AGW_IMAGE:-howardjohn/agentgateway:sl8}"
UI_PORT="${UI_HOST_PORT:-15100}"
MCP_PORT=3030          # must match mcp.port in fixtures/mcp-playground-config.yaml
EVERYTHING_PORT=3005
CFG_DIR="$(cd "$(dirname "$0")/.." && pwd)/.agw-runtime"
SRC_CFG="$(cd "$(dirname "$0")/.." && pwd)/fixtures/mcp-playground-config.yaml"

mkdir -p "$CFG_DIR"
cp "$SRC_CFG" "$CFG_DIR/config.yaml"

cleanup() {
  echo "→ stopping…"
  docker rm -f agw-ui-populated >/dev/null 2>&1 || true
  [[ -n "${MCP_PID:-}" ]] && kill "$MCP_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "→ starting MCP test server on :$EVERYTHING_PORT"
PORT=$EVERYTHING_PORT npx -y @modelcontextprotocol/server-everything streamableHttp >/tmp/mcp-everything.log 2>&1 &
MCP_PID=$!

echo "→ starting agentgateway UI ($IMAGE) on :$UI_PORT (UI) / :$MCP_PORT (MCP)"
docker rm -f agw-ui-populated >/dev/null 2>&1 || true
docker run --rm --name agw-ui-populated --user "$(id -u):$(id -g)" \
  -e ADMIN_ADDR=0.0.0.0:15000 \
  -v "$CFG_DIR:/config" \
  -p "$UI_PORT:15000" -p "$MCP_PORT:$MCP_PORT" -p 4100:4000 \
  "$IMAGE" -f /config/config.yaml &

echo "→ waiting for UI…"
until curl -sf -o /dev/null "http://localhost:$UI_PORT/ui/"; do sleep 1; done
echo "✓ UI ready at http://localhost:$UI_PORT/ui/  — now run:"
echo "    UI_BASE_URL=http://localhost:$UI_PORT npm run test:standalone"
echo "(Ctrl-C to stop)"
wait
