#!/usr/bin/env bash
# Stand up a UI from any one fixture, for the "UI" tab captures in the standalone guides
# (tests/ui-tabs-*.spec.ts). Those captures fill in a drawer and never save, so all they need
# is the agentgateway image with a config that already has whatever the drawer expects to find
# (an LLM model, an MCP server, a named route, and so on). No backends run.
#
#   one command:  npm run test:ui-tabs-<name>   (sets CAPTURE_MODE=fixture and FIXTURE)
#   manual:       FIXTURE=ui-tabs-policies.yaml ./scripts/serve-fixture-ui.sh
#
# FIXTURE names a file in fixtures/. The runtime dir and container are keyed on the UI port,
# so several of these can run side by side on different UI_HOST_PORTs. The fixture is copied
# fresh on every start: a capture that does save would otherwise change the next run's image.
# Ctrl-C tears everything down.
set -euo pipefail

IMAGE="${AGW_IMAGE:-cr.agentgateway.dev/agentgateway:latest-dev}"
UI_PORT="${UI_HOST_PORT:-15100}"
FIXTURE="${FIXTURE:?set FIXTURE to a file in fixtures/}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
# AGW_RUNTIME_DIR moves the mounted config dir outside the repo, for a Docker Desktop that has
# no file-sharing access to the clone (for example, a clone under ~/Documents on macOS).
CFG_DIR="${AGW_RUNTIME_DIR:-$HERE}/.agw-fixture-runtime-$UI_PORT"
NAME="agw-ui-fixture-$UI_PORT"

if [[ ! -f "$HERE/fixtures/$FIXTURE" ]]; then
  echo "ERROR: fixtures/$FIXTURE does not exist." >&2
  exit 1
fi

rm -rf "$CFG_DIR"
mkdir -p "$CFG_DIR"
cp "$HERE/fixtures/$FIXTURE" "$CFG_DIR/config.yaml"
# The UI rewrites the file in place, and the container runs as the current user.
chmod 777 "$CFG_DIR"
chmod 666 "$CFG_DIR/config.yaml"

cleanup() {
  echo "→ stopping…"
  docker rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM
cleanup

echo "→ starting agentgateway UI ($IMAGE) with fixtures/$FIXTURE on :$UI_PORT"
# Only the admin port is published. The captures never send proxy traffic, and leaving the
# gateway ports unpublished is what lets several fixture UIs run at once.
docker run -d --rm --name "$NAME" --user "$(id -u):$(id -g)" \
  -e ADMIN_ADDR=0.0.0.0:15000 \
  -v "$CFG_DIR:/config" \
  -p "$UI_PORT:15000" \
  "$IMAGE" -f /config/config.yaml >/dev/null

echo "→ waiting for UI…"
until curl -sf -o /dev/null "http://localhost:$UI_PORT/ui/"; do sleep 1; done
echo "✓ UI ready at http://localhost:$UI_PORT/ui/ (fixtures/$FIXTURE)"
docker logs -f "$NAME"
