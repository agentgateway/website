#!/usr/bin/env bash
# Stand up the new-UI image with a PRE-SEEDED cost database for the cost-dashboard capture
# (llm/cost-controls/dashboard.md) — deterministic, no real API key, CI-safe:
#   1. seed .agw-runtime/costs.db with deterministic traffic (scripts/seed-costs-db.mjs)
#   2. run the gateway (fixtures/costs-config.yaml) reading that DB, UI on :15100
# The dashboard's Costs/Analytics pages render from the seeded DB — no live traffic needed.
#
# Two ways to use it:
#   - one command:  CAPTURE_MODE=costs npm run test:costs   (Playwright's webServer runs this)
#   - manual:       ./scripts/serve-costs-ui.sh             then capture in another shell
#
# Ctrl-C (or Playwright's webServer teardown) tears it down. Requires Docker + Node 18+ + sqlite3.
set -euo pipefail

IMAGE="${AGW_IMAGE:-ghcr.io/agentgateway/agentgateway:v1.3.1}"
UI_PORT="${UI_HOST_PORT:-15100}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CFG_DIR="$ROOT/.agw-runtime"
NODE="${NODE_BIN:-node}"

mkdir -p "$CFG_DIR"
cp "$ROOT/fixtures/costs-config.yaml" "$CFG_DIR/config.yaml"
cp "$ROOT/fixtures/costs-catalog.json" "$CFG_DIR/costs-catalog.json"

echo "→ seeding cost database at $CFG_DIR/costs.db"
rm -f "$CFG_DIR/costs.db" "$CFG_DIR/costs.db.seed.sql"
"$NODE" "$ROOT/scripts/seed-costs-db.mjs" "$CFG_DIR/costs.db"

cleanup() {
  echo "→ stopping…"
  docker rm -f agw-ui-costs >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "→ starting agentgateway UI ($IMAGE) on :$UI_PORT"
docker rm -f agw-ui-costs >/dev/null 2>&1 || true
docker run --rm --name agw-ui-costs --user "$(id -u):$(id -g)" \
  --add-host=host.docker.internal:host-gateway \
  -e ADMIN_ADDR=0.0.0.0:15000 \
  -v "$CFG_DIR:/config" \
  -p "$UI_PORT:15000" \
  "$IMAGE" -f /config/config.yaml &

echo "→ waiting for UI…"
until curl -sf -o /dev/null "http://localhost:$UI_PORT/ui/"; do sleep 1; done
echo "✓ UI ready at http://localhost:$UI_PORT/ui/"
wait
