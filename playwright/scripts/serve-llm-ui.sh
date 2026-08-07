#!/usr/bin/env bash
# Stand up the new-UI image (sl8) wired to a MOCK OpenAI provider for the LLM playground
# capture — deterministic, no real API key, CI-safe:
#   1. a mock OpenAI server (scripts/mock-openai.mjs) on the host at :8088
#   2. the gateway (fixtures/llm-config.yaml) with hostOverride -> the mock, UI on :15100
#
# Two ways to use it:
#   - one command:  CAPTURE_MODE=llm npm run test:llm   (Playwright's webServer runs this)
#   - manual:       ./scripts/serve-llm-ui.sh           then capture in another shell
#
# Ctrl-C (or Playwright's webServer teardown) tears both down. Requires Docker + Node 18+.
set -euo pipefail

IMAGE="${AGW_IMAGE:-cr.agentgateway.dev/agentgateway:v1.3.0}"
UI_PORT="${UI_HOST_PORT:-15100}"
LLM_PORT=3030          # must match llm.port in fixtures/llm-config.yaml
MOCK_PORT=8088         # must match hostOverride in fixtures/llm-config.yaml
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CFG_DIR="$ROOT/.agw-runtime"

mkdir -p "$CFG_DIR"
cp "$ROOT/fixtures/llm-config.yaml" "$CFG_DIR/config.yaml"

cleanup() {
  echo "→ stopping…"
  docker rm -f agw-ui-llm >/dev/null 2>&1 || true
  [[ -n "${MOCK_PID:-}" ]] && kill "$MOCK_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "→ starting mock OpenAI provider on :$MOCK_PORT"
PORT=$MOCK_PORT node "$ROOT/scripts/mock-openai.mjs" >/tmp/mock-openai.log 2>&1 &
MOCK_PID=$!

echo "→ starting agentgateway UI ($IMAGE) on :$UI_PORT (UI) / :$LLM_PORT (LLM)"
docker rm -f agw-ui-llm >/dev/null 2>&1 || true
docker run --rm --name agw-ui-llm --user "$(id -u):$(id -g)" \
  --add-host=host.docker.internal:host-gateway \
  -e ADMIN_ADDR=0.0.0.0:15000 \
  -v "$CFG_DIR:/config" \
  -p "$UI_PORT:15000" -p "$LLM_PORT:$LLM_PORT" \
  "$IMAGE" -f /config/config.yaml &

echo "→ waiting for UI…"
until curl -sf -o /dev/null "http://localhost:$UI_PORT/ui/"; do sleep 1; done
echo "✓ UI ready at http://localhost:$UI_PORT/ui/"
# Stay foreground until killed (Ctrl-C, or Playwright's webServer teardown) so the trap fires.
wait
