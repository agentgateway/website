#!/usr/bin/env bash
# Stand up the new-UI image with LLM models + virtual keys configured, for the Client Setup
# captures (operations/ui.md #client-setup and the integrations/llm-clients/* guides).
#
# Client Setup only reads configuration and generates client-side snippets, so unlike the other
# modes this launcher starts NO backend: just the gateway with fixtures/client-setup-config.yaml
# and the UI on :15100.
#
# Two ways to use it:
#   - one command:  npm run test:client-setup     (Playwright's webServer runs this)
#   - manual:       ./scripts/serve-client-setup-ui.sh    then capture in another shell
#
# Ctrl-C (or Playwright's webServer teardown) tears it down. Requires Docker + Node 18+.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Resolve the image from the docs' version source of truth (assets/agw-docs/versions/n-patch.md)
# instead of hardcoding a tag, so the capture tracks the release the guides actually install and
# DOC_VERSION=main picks up the nightly. AGW_IMAGE still wins for a one-off pin.
IMAGE="${AGW_IMAGE:-$(node "$ROOT/scripts/resolve-image.mjs" "${DOC_VERSION:-latest}")}"
UI_PORT="${UI_HOST_PORT:-15100}"
CFG_DIR="$ROOT/.agw-runtime"

mkdir -p "$CFG_DIR"
cp "$ROOT/fixtures/client-setup-config.yaml" "$CFG_DIR/config.yaml"

cleanup() {
  echo "→ stopping…"
  docker rm -f agw-ui-client-setup >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "→ starting agentgateway UI ($IMAGE) on :$UI_PORT"
docker rm -f agw-ui-client-setup >/dev/null 2>&1 || true
docker run --rm --name agw-ui-client-setup --user "$(id -u):$(id -g)" \
  -e ADMIN_ADDR=0.0.0.0:15000 \
  -v "$CFG_DIR:/config" \
  -p "$UI_PORT:15000" \
  "$IMAGE" -f /config/config.yaml &

echo "→ waiting for UI…"
until curl -sf -o /dev/null "http://localhost:$UI_PORT/ui/"; do sleep 1; done
echo "✓ UI ready at http://localhost:$UI_PORT/ui/"
wait
