#!/usr/bin/env bash
# Stand up the new-UI image (sl8) with the A2A guide config for the Traffic route/listener
# capture. This is a STATIC config view — no ADK agent or backend reachability is needed,
# so this just runs the gateway with fixtures/a2a-config.yaml and serves the UI.
#
# Then capture against it:
#   UI_BASE_URL=http://localhost:15100 npm run test:standalone -- a2a-traffic.spec.ts
#
# Ctrl-C tears it down. Requires Docker.
set -euo pipefail

IMAGE="${AGW_IMAGE:-howardjohn/agentgateway:sl8}"
UI_PORT="${UI_HOST_PORT:-15100}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CFG_DIR="$ROOT/.agw-runtime"

mkdir -p "$CFG_DIR"
cp "$ROOT/fixtures/a2a-config.yaml" "$CFG_DIR/config.yaml"

cleanup() { docker rm -f agw-ui-a2a >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

echo "→ starting agentgateway UI ($IMAGE) on :$UI_PORT with the A2A config"
docker rm -f agw-ui-a2a >/dev/null 2>&1 || true
docker run --rm --name agw-ui-a2a --user "$(id -u):$(id -g)" \
  -e ADMIN_ADDR=0.0.0.0:15000 \
  -v "$CFG_DIR:/config" \
  -p "$UI_PORT:15000" \
  "$IMAGE" -f /config/config.yaml &

until curl -sf -o /dev/null "http://localhost:$UI_PORT/ui/"; do sleep 1; done
echo "✓ UI ready at http://localhost:$UI_PORT/ui/  — now run:"
echo "    UI_BASE_URL=http://localhost:$UI_PORT npm run test:standalone -- a2a-traffic.spec.ts"
echo "(Ctrl-C to stop)"
wait
