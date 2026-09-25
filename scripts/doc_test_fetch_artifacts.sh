#!/bin/bash
# Build script that fetches test results and injects test status before Hugo build.
# Used by Cloudflare Pages during deployment.
#
# Test results only drive the "Verified" badge, so every failure here is a
# warning: the build continues without the badge rather than breaking the deploy.

set -e

REPO="agentgateway/website"
ARTIFACT_NAME="doc-test-results"
RESULTS_DIR="out/tests/generated"
RESULTS_FILE="$RESULTS_DIR/test-results.yaml"
# How many recent runs to search for a live artifact. Artifacts are kept for 14
# days, so a run older than that has nothing left to download.
MAX_RUNS=15

# Check if results directory already exists with results file
if [ -f "$RESULTS_FILE" ]; then
    echo "=== Test results already exist at $RESULTS_FILE, skipping fetch ==="
    exit 0
fi

echo "=== Fetching latest doc test results ==="

# Create output directory
mkdir -p "$RESULTS_DIR"

if [ -z "$GITHUB_TOKEN" ]; then
    echo "Warning: GITHUB_TOKEN not set, skipping artifact download"
    exit 0
fi

echo "Fetching artifact list from GitHub API..."

RUN_INFO=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
    "https://api.github.com/repos/$REPO/actions/workflows/doc-tests.yaml/runs?branch=main&status=completed&per_page=$MAX_RUNS" || echo "")

# Most recent completed runs on main, newest first
RUN_IDS=$(echo "$RUN_INFO" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
for run in data.get('workflow_runs', []):
    if run.get('head_branch') == 'main':
        print(run['id'])
" 2>/dev/null || echo "")

if [ -z "$RUN_IDS" ]; then
    echo "Warning: No completed workflow runs found"
    exit 0
fi

# Walk back from the newest run until one still has an unexpired artifact
ARTIFACT_URL=""
FOUND_RUN=""
for RUN_ID in $RUN_IDS; do
    ARTIFACTS=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
        "https://api.github.com/repos/$REPO/actions/runs/$RUN_ID/artifacts?per_page=100" || echo "")

    ARTIFACT_URL=$(echo "$ARTIFACTS" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
for artifact in data.get('artifacts', []):
    if artifact.get('name') == '$ARTIFACT_NAME' and not artifact.get('expired'):
        print(artifact['archive_download_url'])
        break
" 2>/dev/null || echo "")

    if [ -n "$ARTIFACT_URL" ]; then
        FOUND_RUN="$RUN_ID"
        break
    fi
done

if [ -z "$ARTIFACT_URL" ]; then
    echo "Warning: No unexpired $ARTIFACT_NAME artifact in the last $MAX_RUNS runs on main"
    exit 0
fi

echo "Found workflow run: $FOUND_RUN"
echo "Downloading artifact..."

HTTP_CODE=$(curl -s -L -H "Authorization: token $GITHUB_TOKEN" \
    -o artifact.zip -w '%{http_code}' "$ARTIFACT_URL" || echo "000")

if [ "$HTTP_CODE" != "200" ]; then
    # An expired or unauthorized download returns a JSON error body, not a zip
    echo "Warning: Artifact download failed with HTTP $HTTP_CODE, skipping test status"
    rm -f artifact.zip
    exit 0
fi

# Guard against a non-zip body that still came back as 200
if ! unzip -tqq artifact.zip >/dev/null 2>&1; then
    echo "Warning: Downloaded artifact is not a valid zip, skipping test status"
    rm -f artifact.zip
    exit 0
fi

unzip -o -q artifact.zip -d "$RESULTS_DIR"
rm -f artifact.zip
echo "Artifact extracted to $RESULTS_DIR"
