#!/usr/bin/env bash
# Stand up a UI backed by a writable config file for the default-storage capture
# (storage-file.spec.ts): just the agentgateway image with fixtures/file-storage-config.yaml
# (storage.mode: file) on a writable mount. No database.
#
#   one command:  CAPTURE_MODE=file npm run test:file   (Playwright's webServer runs this)
#   manual:       ./scripts/serve-file-ui.sh            then capture in another shell
#
# This is the counterpart to serve-storage-ui.sh: there the UI writes to PostgreSQL, here it
# writes to the YAML file itself. The runtime dir is separate (.agw-file-runtime) so a run
# never inherits an MCP target that a previous run saved into the file, which would change
# what the "Add server" capture shows. Ctrl-C tears everything down.
set -euo pipefail

IMAGE="${AGW_IMAGE:-cr.agentgateway.dev/agentgateway:latest-dev}"
UI_PORT="${UI_HOST_PORT:-15100}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
CFG_DIR="$HERE/.agw-file-runtime"

# Start from the fixture every time: the UI writes into this file, so a stale copy would
# already list the target that the capture is supposed to be adding.
rm -rf "$CFG_DIR"
mkdir -p "$CFG_DIR"
cp "$HERE/fixtures/file-storage-config.yaml" "$CFG_DIR/config.yaml"

cleanup() {
  echo "→ stopping…"
  docker rm -f agw-ui-file >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM
cleanup

echo "→ starting agentgateway UI ($IMAGE) on :$UI_PORT"
docker run -d --rm --name agw-ui-file --user "$(id -u):$(id -g)" \
  -e ADMIN_ADDR=0.0.0.0:15000 \
  -v "$CFG_DIR:/config" \
  -p "$UI_PORT:15000" -p 4100:4000 \
  "$IMAGE" -f /config/config.yaml >/dev/null

echo "→ waiting for UI…"
until curl -sf -o /dev/null "http://localhost:$UI_PORT/ui/"; do sleep 1; done
echo "✓ UI ready at http://localhost:$UI_PORT/ui/ (storage.mode: file, writable mount)"
docker logs -f agw-ui-file
