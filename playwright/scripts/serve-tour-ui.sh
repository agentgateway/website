#!/usr/bin/env bash
# Stand up a POPULATED agentgateway UI for the UI tour capture (setup/ui/launch-ui):
#   1. mock-mcp-time (host :3011, fixed output) -> the `time` MCP target
#   2. mock-openai   (host :8088, fixed reply)  -> the gpt-4o-mini LLM model
#   3. the UI image with fixtures/tour-config.yaml, serving the UI at http://localhost:15100/ui/
#
# The Traffic routes in the fixture point at example.com hosts that are never reached; those
# pages render the config statically. Only the MCP and LLM pages talk to a backend, so only
# those two run, and both are deterministic mocks.
#
# Two ways to use it:
#   - one command:  CAPTURE_MODE=tour npm run test:tour   (Playwright's webServer runs this)
#   - manual:       ./scripts/serve-tour-ui.sh            then capture in another shell
#
# Ctrl-C (or Playwright's webServer teardown) tears everything down. Requires Docker + Node 18+.
set -euo pipefail

IMAGE="${AGW_IMAGE:-cr.agentgateway.dev/agentgateway:v1.6.0}"
UI_PORT="${UI_HOST_PORT:-15100}"
TIME_PORT=3011         # must match the mcp target host in fixtures/tour-config.yaml
OPENAI_PORT=8088       # must match hostOverride in fixtures/tour-config.yaml
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# AGW_RUNTIME_DIR moves the mounted config dir outside the repo, for a Docker Desktop that has
# no file-sharing access to the clone (for example, a clone under ~/Documents on macOS).
CFG_DIR="${AGW_RUNTIME_DIR:-$ROOT/.agw-runtime}"
NODE="${NODE_BIN:-node}"

mkdir -p "$CFG_DIR"
cp "$ROOT/fixtures/tour-config.yaml" "$CFG_DIR/config.yaml"

cleanup() {
  echo "→ stopping…"
  docker rm -f agw-ui-tour >/dev/null 2>&1 || true
  [[ -n "${TIME_PID:-}" ]] && kill "$TIME_PID" >/dev/null 2>&1 || true
  [[ -n "${OPENAI_PID:-}" ]] && kill "$OPENAI_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "→ starting mock-mcp-time on :$TIME_PORT"
PORT=$TIME_PORT "$NODE" "$ROOT/scripts/mock-mcp-time.mjs" >/tmp/mcp-time-tour.log 2>&1 &
TIME_PID=$!

echo "→ starting mock-openai on :$OPENAI_PORT"
PORT=$OPENAI_PORT "$NODE" "$ROOT/scripts/mock-openai.mjs" >/tmp/mock-openai-tour.log 2>&1 &
OPENAI_PID=$!

echo "→ starting agentgateway UI ($IMAGE) on :$UI_PORT"
docker rm -f agw-ui-tour >/dev/null 2>&1 || true
docker run --rm --name agw-ui-tour --user "$(id -u):$(id -g)" \
  --add-host=host.docker.internal:host-gateway \
  --add-host=mcp-time.example.com:host-gateway \
  -e ADMIN_ADDR=0.0.0.0:15000 \
  -v "$CFG_DIR:/config" \
  -p "$UI_PORT:15000" \
  "$IMAGE" -f /config/config.yaml &

echo "→ waiting for UI…"
until curl -sf -o /dev/null "http://localhost:$UI_PORT/ui/"; do sleep 1; done
echo "✓ UI ready at http://localhost:$UI_PORT/ui/"
wait
