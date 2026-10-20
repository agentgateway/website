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

# Playwright passes AGW_IMAGE (resolved from DOC_VERSION in playwright.config.ts). On a manual run,
# resolve it the same way. The fixtures are written for the UI tabs in docs 1.7 and later, so a
# manual run defaults to the `main` line (the nightly image) rather than `latest`.
IMAGE="${AGW_IMAGE:-$(cd "$(dirname "$0")/.." && node -e 'import("./scripts/resolve-image.mjs").then(m=>console.log(m.resolveImage(process.env.DOC_VERSION||"main")))')}"
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
# No --rm: if the container exits early, its logs are still there to print. cleanup removes it.
docker run -d --name "$NAME" --user "$(id -u):$(id -g)" \
  -e ADMIN_ADDR=0.0.0.0:15000 \
  -v "$CFG_DIR:/config" \
  -p "$UI_PORT:15000" \
  "$IMAGE" -f /config/config.yaml >/dev/null

echo "→ waiting for UI…"
until curl -sf -o /dev/null "http://localhost:$UI_PORT/ui/"; do
  # Stop waiting if the container exited (for example, the image rejected the fixture), instead
  # of polling until Playwright's 240-second webServer timeout.
  if [[ "$(docker inspect -f '{{.State.Running}}' "$NAME" 2>/dev/null)" != "true" ]]; then
    echo "ERROR: the agentgateway container exited before the UI answered:" >&2
    docker logs "$NAME" 2>&1 | tail -20 >&2 || true
    exit 1
  fi
  sleep 1
done
echo "✓ UI ready at http://localhost:$UI_PORT/ui/ (fixtures/$FIXTURE)"
docker logs -f "$NAME"
