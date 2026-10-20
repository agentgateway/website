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

# Playwright passes AGW_IMAGE (resolved from DOC_VERSION in playwright.config.ts). On a manual run,
# resolve it the same way, so the image matches the docs line that the captures are for.
IMAGE="${AGW_IMAGE:-$(cd "$(dirname "$0")/.." && node -e 'import("./scripts/resolve-image.mjs").then(m=>console.log(m.resolveImage(process.env.DOC_VERSION||"latest")))')}"
UI_PORT="${UI_HOST_PORT:-15100}"
TIME_PORT=3011         # must match the mcp target host in fixtures/tour-config.yaml
OPENAI_PORT=8088       # must match hostOverride in fixtures/tour-config.yaml
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# AGW_RUNTIME_DIR moves the mounted config dir outside the repo, for a Docker Desktop that has
# no file-sharing access to the clone (for example, a clone under ~/Documents on macOS).
CFG_DIR="${AGW_RUNTIME_DIR:-$ROOT/.agw-runtime}"
NODE="${NODE_BIN:-node}"

# Refuse to start over another UI. A leftover container on the port makes `docker run` fail to
# bind, but the readiness loop below would still see a UI answer and report ready, so the specs
# would capture whatever build was left behind (for example, an enterprise image from the docs
# hub harness, which uses the same port).
# This check covers manual runs only. Under Playwright, webServer.reuseExistingServer attaches to
# anything that already answers on the port and never starts this script. `npm run capture:all`
# and `update:all` run `clean:ui` before every mode, which removes such a container; before a
# single `npm run test:tour`, run `npm run clean:ui` yourself.
if curl -sf -o /dev/null "http://localhost:$UI_PORT/ui/"; then
  echo "ERROR: something already serves http://localhost:$UI_PORT/ui/. Run 'npm run clean:ui' first." >&2
  exit 1
fi

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
AGW_PID=$!

echo "→ waiting for UI…"
until curl -sf -o /dev/null "http://localhost:$UI_PORT/ui/"; do
  # Stop waiting if the container exited (for example, the image rejected the fixture), instead
  # of polling until Playwright's 240-second webServer timeout.
  if ! kill -0 "$AGW_PID" 2>/dev/null; then
    echo "ERROR: the agentgateway container exited before the UI answered. See its output above." >&2
    exit 1
  fi
  sleep 1
done
echo "✓ UI ready at http://localhost:$UI_PORT/ui/"
wait
