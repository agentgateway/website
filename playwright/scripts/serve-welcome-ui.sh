#!/usr/bin/env bash
# Stand up a UI in its genuine first-run state for the welcome-wizard capture
# (welcome.spec.ts):
#   the new-UI image with an EMPTY, writable /config and no -f flag, so the gateway
#   bootstraps its own config exactly like `agentgateway` with no arguments does.
#
#   one command:  CAPTURE_MODE=welcome npm run test:welcome   (Playwright's webServer runs this)
#   manual:       ./scripts/serve-welcome-ui.sh               then capture in another shell
#
# Why this mode exists instead of reusing the default empty-config launcher:
#
#   1. No -f. The quickstarts tell the reader to run a bare `agentgateway`, which bootstraps
#      ~/.config/agentgateway/config.yaml (a `default` gateway on 4000, UI attached to it).
#      Passing -f, as every other launcher does, would skip that path and capture a state no
#      reader ever sees.
#   2. A private, wiped runtime dir. The welcome wizard only renders while no capability is
#      enabled, so this capture is the one that depends on the config being pristine. The
#      shared .agw-runtime is not: sibling launchers copy their own fixture to
#      .agw-runtime/config.yaml and leave it there, so a run after those would boot with that
#      config and the wizard would never appear — a green test with the wrong image. Wiping a
#      dedicated dir on every start makes "first run" true every time.
#
# Ctrl-C tears everything down.
set -euo pipefail

IMAGE="${AGW_IMAGE:-$(node -e 'import("./scripts/resolve-image.mjs").then(m=>console.log(m.resolveImage(process.env.DOC_VERSION||"latest")))')}"
UI_PORT="${UI_HOST_PORT:-15100}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
# Deliberately NOT .agw-runtime — see note 2 above.
CFG_DIR="$HERE/.agw-welcome-runtime"

cleanup() {
  echo "→ stopping…"
  docker rm -f agw-ui-welcome >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "→ resetting $CFG_DIR so the gateway bootstraps a first-run config"
rm -rf "$CFG_DIR"
mkdir -p "$CFG_DIR"

echo "→ starting agentgateway UI ($IMAGE) on :$UI_PORT — no -f, config bootstraps into /config"
docker rm -f agw-ui-welcome >/dev/null 2>&1 || true
docker run --rm --name agw-ui-welcome --user "$(id -u):$(id -g)" \
  -e ADMIN_ADDR=0.0.0.0:15000 \
  -v "$CFG_DIR:/config" \
  -p "$UI_PORT:15000" -p 4100:4000 \
  "$IMAGE" &

echo "→ waiting for UI…"
until curl -sf -o /dev/null "http://localhost:$UI_PORT/ui/"; do sleep 1; done
echo "✓ UI ready at http://localhost:$UI_PORT/ui/"
wait
