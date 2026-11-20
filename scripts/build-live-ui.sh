#!/usr/bin/env bash
# Builds the interactive agentgateway UI shown on the homepage.
#
# It compiles the real admin UI from agentgateway/agentgateway at a release tag and adds
# scripts/live-ui/mock-api.js, an in-browser stand-in for the gateway's admin API, LLM
# endpoint, and MCP endpoint. The result goes to static/live-ui/ and is embedded by
# layouts/partials/live-ui.html. Nothing in the page talks to a real gateway.
#
# Usage: scripts/build-live-ui.sh [tag]   (default: v1.7.0)
# Needs git, Node 22+, and pnpm.
set -euo pipefail

TAG="${1:-v1.7.0}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/scripts/live-ui"
OUT="$ROOT/static/live-ui"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Fetching agentgateway $TAG UI source"
git clone -q --depth 1 --branch "$TAG" --filter=blob:none --sparse \
	https://github.com/agentgateway/agentgateway.git "$WORK/agw"
git -C "$WORK/agw" sparse-checkout set ui schema

echo "Building the UI"
(
	cd "$WORK/agw/ui"
	pnpm install --frozen-lockfile --silent
	node scripts/generate-schema.mjs
	npx vite build --base /live-ui/ --outDir "$WORK/dist" --emptyOutDir
)

echo "Writing $OUT"
mkdir -p "$OUT"
find "$OUT" -mindepth 1 -delete
cp -R "$WORK/dist/." "$OUT/"
cp "$SRC/mock-api.js" "$OUT/mock-api.js"
printf 'window.__AGW_MOCK_MCP_TOOLS = %s;\n' "$(cat "$SRC/mcp-tools.json")" > "$OUT/mcp-tools.js"

# Load the mock before the UI bundle (module scripts run after classic ones).
python3 - "$OUT/index.html" <<'PY'
import sys
path = sys.argv[1]
html = open(path).read()
tag = '<script src="/live-ui/mcp-tools.js"></script><script src="/live-ui/mock-api.js"></script>'
if 'mock-api.js' not in html:
    html = html.replace('<head>', '<head>\n    ' + tag, 1)
open(path, 'w').write(html)
PY

echo "Done: $(du -sh "$OUT" | cut -f1) in static/live-ui ($TAG)"
